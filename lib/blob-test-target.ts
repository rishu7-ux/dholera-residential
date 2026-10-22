type LinkedVercelProject = {
  orgId: string;
  projectId: string;
  projectName: string;
};

type BlobTestTargetInput = {
  expectedOwnerSlug?: string;
  expectedStoreId: string | undefined;
  linkedProject?: LinkedVercelProject;
  now?: Date;
  oidcStoreId?: string;
  oidcToken?: string;
  readWriteToken?: string;
  vercelEnvironment?: string;
};

type BlobTestTarget = {
  authKind: "oidc" | "read-write-token";
  authOptions: { oidcToken: string; storeId: string } | { token: string };
  hostnameStoreId: string;
  storeId: string;
};

type OidcClaims = {
  aud?: string | string[];
  environment?: string;
  exp?: number;
  iss?: string;
  nbf?: number;
  owner?: string;
  owner_id?: string;
  project?: string;
  project_id?: string;
  sub?: string;
};

const STORE_ID_PATTERN = /^store_([a-z\d]+)$/i;
const READ_WRITE_TOKEN_PATTERN = /^vercel_blob_rw_([a-z\d]+)_[a-z\d]+$/i;
const ALLOWED_TEST_ENVIRONMENTS = new Set(["development", "preview"]);
const MINIMUM_TOKEN_LIFETIME_SECONDS = 60;

function parseStoreId(value: string | undefined, label: string) {
  const storeId = value?.trim();
  const match = storeId?.match(STORE_ID_PATTERN);
  if (!storeId || !match) {
    throw new Error(`${label} must use the Vercel store_<id> format`);
  }

  return {
    comparable: match[1].toLowerCase(),
    hostnameStoreId: match[1],
    storeId,
  };
}

function decodeOidcClaims(token: string): OidcClaims {
  const segments = token.split(".");
  if (segments.length !== 3 || segments.some((segment) => !segment)) {
    throw new Error("VERCEL_OIDC_TOKEN is not a JWT");
  }

  try {
    const claims = JSON.parse(
      Buffer.from(segments[1], "base64url").toString("utf8"),
    ) as OidcClaims;
    if (!claims || typeof claims !== "object" || Array.isArray(claims)) {
      throw new Error("invalid claims");
    }
    return claims;
  } catch {
    throw new Error("VERCEL_OIDC_TOKEN has an invalid claims payload");
  }
}

function audienceIncludes(audience: string | string[] | undefined, expected: string) {
  return Array.isArray(audience)
    ? audience.includes(expected)
    : audience === expected;
}

export function validateBlobTestTarget(
  input: BlobTestTargetInput,
): BlobTestTarget {
  const expectedStore = parseStoreId(
    input.expectedStoreId,
    "TEST_BLOB_STORE_ID",
  );
  const readWriteToken = input.readWriteToken?.trim();
  const oidcToken = input.oidcToken?.trim();

  if (readWriteToken && oidcToken) {
    throw new Error("Refusing ambiguous Blob authentication credentials");
  }

  if (readWriteToken) {
    const tokenMatch = readWriteToken.match(READ_WRITE_TOKEN_PATTERN);
    if (!tokenMatch) {
      throw new Error(
        "BLOB_READ_WRITE_TOKEN does not use the supported Vercel Blob token format",
      );
    }

    if (tokenMatch[1].toLowerCase() !== expectedStore.comparable) {
      throw new Error("BLOB_READ_WRITE_TOKEN does not belong to TEST_BLOB_STORE_ID");
    }

    return {
      authKind: "read-write-token",
      authOptions: { token: readWriteToken },
      hostnameStoreId: expectedStore.hostnameStoreId,
      storeId: expectedStore.storeId,
    };
  }

  if (!oidcToken) {
    throw new Error(
      "TEST Blob rehearsal requires either BLOB_READ_WRITE_TOKEN or VERCEL_OIDC_TOKEN",
    );
  }

  const oidcStore = parseStoreId(input.oidcStoreId, "BLOB_STORE_ID");
  if (oidcStore.comparable !== expectedStore.comparable) {
    throw new Error("BLOB_STORE_ID does not match TEST_BLOB_STORE_ID");
  }

  const ownerSlug = input.expectedOwnerSlug?.trim();
  const linkedProject = input.linkedProject;
  if (!ownerSlug || !linkedProject) {
    throw new Error("OIDC rehearsal requires the expected owner and linked project metadata");
  }

  const claims = decodeOidcClaims(oidcToken);
  const environment = claims.environment?.trim();
  if (!environment || !ALLOWED_TEST_ENVIRONMENTS.has(environment)) {
    throw new Error("VERCEL_OIDC_TOKEN must target a non-production TEST environment");
  }
  const pulledEnvironment = input.vercelEnvironment?.trim();
  if (pulledEnvironment && !ALLOWED_TEST_ENVIRONMENTS.has(pulledEnvironment)) {
    throw new Error("VERCEL_ENV must target a non-production TEST environment");
  }

  const expectedIssuer = `https://oidc.vercel.com/${ownerSlug}`;
  const expectedAudience = `https://vercel.com/${ownerSlug}`;
  const expectedSubject = `owner:${ownerSlug}:project:${linkedProject.projectName}:environment:${environment}`;
  if (
    claims.iss !== expectedIssuer
    || !audienceIncludes(claims.aud, expectedAudience)
    || claims.sub !== expectedSubject
    || claims.owner !== ownerSlug
    || claims.owner_id !== linkedProject.orgId
    || claims.project !== linkedProject.projectName
    || claims.project_id !== linkedProject.projectId
  ) {
    throw new Error("VERCEL_OIDC_TOKEN does not match the approved linked TEST project");
  }

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (
    typeof claims.nbf !== "number"
    || typeof claims.exp !== "number"
    || claims.nbf > nowSeconds
    || claims.exp <= nowSeconds + MINIMUM_TOKEN_LIFETIME_SECONDS
  ) {
    throw new Error("VERCEL_OIDC_TOKEN is not active or is too close to expiry");
  }

  return {
    authKind: "oidc",
    authOptions: {
      oidcToken,
      storeId: oidcStore.storeId,
    },
    hostnameStoreId: expectedStore.hostnameStoreId,
    storeId: expectedStore.storeId,
  };
}
