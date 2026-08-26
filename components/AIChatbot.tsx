"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import {
  FaArrowUp,
  FaBuilding,
  FaComments,
  FaEnvelope,
  FaPhoneAlt,
  FaRobot,
  FaTimes,
  FaUser,
  FaWhatsapp,
} from "react-icons/fa";

/* =========================================================
   TYPES
========================================================= */

type Message = {
  id: number;
  role: "assistant" | "user";
  text: string;
};

/* =========================================================
   INITIAL MESSAGE
========================================================= */

const initialMessages: Message[] = [
  {
    id: 1,
    role: "assistant",
    text:
      "Hi 👋 Welcome to Omana Projects. I’m your Dholera Property Assistant. I can help you with property details, plot sizes, prices, locations, investment options and site visits.",
  },
];

/* =========================================================
   QUICK QUESTIONS
========================================================= */

const quickQuestions = [
  "Residential Plots",
  "SCO Plots",
  "Industrial Plots",
  "Property Prices",
  "Site Visit",
  "Contact Team",
];

/* =========================================================
   COMPONENT
========================================================= */

export default function AIChatbot() {
  const [open, setOpen] = useState(false);

  const [messages, setMessages] =
    useState<Message[]>(initialMessages);

  const [input, setInput] = useState("");

  const [typing, setTyping] = useState(false);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  /* =========================================================
     AUTO SCROLL
  ========================================================= */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, typing]);

  /* =========================================================
     DUMMY RESPONSE
     LATER CONNECT THIS WITH AI API
  ========================================================= */

  const getDummyResponse = (
    message: string
  ) => {
    const value =
      message.toLowerCase();

    /* CONTACT */

    if (
      value.includes("contact") ||
      value.includes("phone") ||
      value.includes("call")
    ) {
      return "You can contact our property team at +91 92171 04219. You can also connect with us on WhatsApp for property enquiries and site visits.";
    }

    /* RESIDENTIAL */

    if (
      value.includes("residential")
    ) {
      return "We have residential plot opportunities in Dholera. I can help you with location, plot size, project information, pricing and investment options.";
    }

    /* SCO */

    if (
      value.includes("sco") ||
      value.includes("commercial")
    ) {
      return "We have SCO and commercial property options in Dholera. These projects can be compared based on location, TP scheme, road width, plot size and pricing.";
    }

    /* INDUSTRIAL */

    if (
      value.includes("industrial")
    ) {
      return "We can help you explore industrial plots and investment opportunities in Dholera. Tell me your preferred plot size or investment budget.";
    }

    /* PRICE */

    if (
      value.includes("price") ||
      value.includes("budget")
    ) {
      return "Property pricing depends on the project, plot size and current availability. Tell me which property you are interested in and I’ll guide you further.";
    }

    /* SITE VISIT */

    if (
      value.includes("site") ||
      value.includes("visit")
    ) {
      return "Sure. Our team can help you arrange a Dholera property site visit. You can call or WhatsApp us on +91 92171 04219.";
    }

    /* DEFAULT */

    return "I can help you with Dholera residential plots, SCO plots, industrial properties, prices, plot sizes, locations and site visits. What would you like to know?";
  };

  /* =========================================================
     SEND MESSAGE
  ========================================================= */

  const handleSend = (
    customMessage?: string
  ) => {
    const value =
      customMessage ||
      input.trim();

    if (!value || typing) {
      return;
    }

    /* USER MESSAGE */

    const userMessage: Message = {
      // eslint-disable-next-line react-hooks/purity
      id: Date.now(),
      role: "user",
      text: value,
    };

    setMessages((prev) => [
      ...prev,
      userMessage,
    ]);

    setInput("");

    setTyping(true);

    /* DUMMY AI REPLY */

    window.setTimeout(() => {
      const response =
        getDummyResponse(value);

      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        text: response,
      };

      setMessages((prev) => [
        ...prev,
        assistantMessage,
      ]);

      setTyping(false);
    }, 700);
  };

  /* =========================================================
     CLEAR CHAT
  ========================================================= */

  const clearChat = () => {
    setMessages(initialMessages);

    setInput("");

    setTyping(false);
  };

  return (
    <>
      {/* =====================================================
          FLOATING CHAT BUTTON
      ===================================================== */}

      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            onClick={() =>
              setOpen(true)
            }
            initial={{
              opacity: 0,
              scale: 0.8,
              y: 15,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.8,
              y: 15,
            }}
            transition={{
              duration: 0.35,
            }}
            whileHover={{
              y: -4,
              scale: 1.05,
            }}
            whileTap={{
              scale: 0.95,
            }}
            aria-label="Open AI Chat"
            className="
              fixed
              bottom-5
              right-4
              z-9998

              flex
              h-14
              w-14
              items-center
              justify-center

              rounded-full

              bg-[#FF7A00]

              text-white

              shadow-[0_12px_35px_rgba(255,122,0,0.35)]

              transition-all
              duration-300

              hover:bg-[#FF9638]

              sm:bottom-6
              sm:right-6
            "
          >
            <FaComments className="text-xl" />

            {/* PULSE */}

            <motion.span
              animate={{
                scale: [
                  1,
                  1.4,
                  1,
                ],
                opacity: [
                  0.4,
                  0,
                  0.4,
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
              className="
                pointer-events-none
                absolute
                inset-0

                rounded-full

                border-2
                border-[#FF7A00]
              "
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* =====================================================
          CHAT WINDOW
      ===================================================== */}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.92,
              y: 30,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.92,
              y: 30,
            }}
            transition={{
              duration: 0.35,
              ease: [
                0.22,
                1,
                0.36,
                1,
              ],
            }}
            className="
              fixed
              bottom-3
              right-3
              z-9999

              flex
              h-145
              w-[calc(100%-24px)]
              max-w-92.5
              flex-col

              overflow-hidden

              rounded-3xl

              border
              border-[#FF7A00]/15

              bg-white

              shadow-[0_25px_70px_rgba(50,30,15,0.25)]

              sm:bottom-6
              sm:right-6
              sm:h-150
              sm:max-w-97.5
            "
          >
            {/* =================================================
                HEADER
            ================================================= */}

            <div
              className="
                relative
                overflow-hidden

                bg-[#FF7A00]

                px-4
                py-3.5

                text-white
              "
            >
              {/* DECORATION */}

              <div
                className="
                  pointer-events-none
                  absolute
                  -right-10
                  -top-14

                  h-32
                  w-32

                  rounded-full

                  bg-white/10
                "
              />

              <div
                className="
                  relative

                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >
                {/* LEFT */}

                <div
                  className="
                    flex
                    min-w-0
                    items-center
                    gap-3
                  "
                >
                  {/* BOT ICON */}

                  <div
                    className="
                      relative

                      flex
                      h-10
                      w-10
                      shrink-0
                      items-center
                      justify-center

                      rounded-xl

                      bg-white

                      text-[#FF7A00]

                      shadow-sm
                    "
                  >
                    <FaRobot />

                    {/* ONLINE */}

                    <span
                      className="
                        absolute
                        -bottom-0.5
                        -right-0.5

                        h-3
                        w-3

                        rounded-full

                        border-2
                        border-[#FF7A00]

                        bg-green-400
                      "
                    />
                  </div>

                  <div className="min-w-0">
                    <h3
                      className="
                        truncate

                        text-[14px]
                        font-extrabold

                        sm:text-[15px]
                      "
                    >
                      Omana AI Assistant
                    </h3>

                    <p
                      className="
                        mt-0.5

                        text-[9px]
                        font-medium

                        text-white/80
                      "
                    >
                      Online • Dholera Property Support
                    </p>
                  </div>
                </div>

                {/* CLOSE */}

                <motion.button
                  type="button"
                  onClick={() =>
                    setOpen(false)
                  }
                  whileHover={{
                    rotate: 90,
                    scale: 1.08,
                  }}
                  whileTap={{
                    scale: 0.9,
                  }}
                  aria-label="Close chat"
                  className="
                    flex
                    h-8
                    w-8
                    shrink-0
                    items-center
                    justify-center

                    rounded-full

                    bg-white/15

                    text-white

                    transition-all
                    duration-300

                    hover:bg-white
                    hover:text-[#FF7A00]
                  "
                >
                  <FaTimes size={12} />
                </motion.button>
              </div>
            </div>

            {/* =================================================
                CONTACT BAR
            ================================================= */}

            <div
              className="
                grid
                grid-cols-3

                border-b
                border-[#FF7A00]/10

                bg-white
              "
            >
              {/* CALL */}

              <a
                href="tel:+919217104219"
                className="
                  flex
                  items-center
                  justify-center
                  gap-1.5

                  border-r
                  border-[#FF7A00]/10

                  py-2.5

                  text-[9px]
                  font-bold

                  text-gray-600

                  transition-all
                  duration-300

                  hover:bg-[#FFF4E8]
                  hover:text-[#FF7A00]
                "
              >
                <FaPhoneAlt />

                Call
              </a>

              {/* WHATSAPP */}

              <a
                href="https://wa.me/919217104219"
                target="_blank"
                rel="noopener noreferrer"
                className="
                  flex
                  items-center
                  justify-center
                  gap-1.5

                  border-r
                  border-[#FF7A00]/10

                  py-2.5

                  text-[9px]
                  font-bold

                  text-gray-600

                  transition-all
                  duration-300

                  hover:bg-[#F0FFF4]
                  hover:text-[#25D366]
                "
              >
                <FaWhatsapp />

                WhatsApp
              </a>

              {/* EMAIL */}

              <a
                href="mailto:sales@dholeraresidentialplot.com"
                className="
                  flex
                  items-center
                  justify-center
                  gap-1.5

                  py-2.5

                  text-[9px]
                  font-bold

                  text-gray-600

                  transition-all
                  duration-300

                  hover:bg-[#FFF4E8]
                  hover:text-[#FF7A00]
                "
              >
                <FaEnvelope />

                Email
              </a>
            </div>

            {/* =================================================
                QUICK QUESTIONS
            ================================================= */}

            <div
              className="
                border-b
                border-[#FF7A00]/10

                bg-[#FFF9F5]

                px-3
                py-2.5
              "
            >
              <div
                className="
                  flex
                  gap-2

                  overflow-x-auto

                  scrollbar-none
                  [&::-webkit-scrollbar]:hidden
                "
              >
                {quickQuestions.map(
                  (item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() =>
                        handleSend(
                          item
                        )
                      }
                      className="
                        shrink-0

                        rounded-full

                        border
                        border-[#FF7A00]/20

                        bg-white

                        px-3
                        py-1.5

                        text-[9px]
                        font-semibold

                        text-[#FF7A00]

                        transition-all
                        duration-300

                        hover:bg-[#FF7A00]
                        hover:text-white
                      "
                    >
                      {item}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* =================================================
                MESSAGES
            ================================================= */}

            <div
              className="
                flex-1

                overflow-y-auto

                bg-[#FFF9F5]

                p-3

                sm:p-4

                scrollbar-thin
              "
            >
              <div className="space-y-3">
                {messages.map(
                  (message) => (
                    <motion.div
                      key={message.id}
                      initial={{
                        opacity: 0,
                        y: 10,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      className={
                        message.role ===
                        "user"
                          ? "flex justify-end"
                          : "flex justify-start"
                      }
                    >
                      <div
                        className="
                          flex
                          max-w-[88%]
                          items-end
                          gap-2
                        "
                      >
                        {/* ASSISTANT */}

                        {message.role ===
                          "assistant" && (
                          <span
                            className="
                              flex
                              h-7
                              w-7
                              shrink-0
                              items-center
                              justify-center

                              rounded-lg

                              bg-[#FF7A00]

                              text-[10px]
                              text-white
                            "
                          >
                            <FaRobot />
                          </span>
                        )}

                        {/* MESSAGE */}

                        <div
                          className={
                            message.role ===
                            "user"
                              ? `
                                rounded-2xl
                                rounded-br-md

                                bg-[#FF7A00]

                                px-3
                                py-2.5

                                text-[11px]
                                leading-5

                                text-white

                                shadow-[0_5px_14px_rgba(255,122,0,0.15)]
                              `
                              : `
                                rounded-2xl
                                rounded-bl-md

                                border
                                border-[#FF7A00]/10

                                bg-white

                                px-3
                                py-2.5

                                text-[11px]
                                leading-5

                                text-gray-700

                                shadow-sm
                              `
                          }
                        >
                          {
                            message.text
                          }
                        </div>

                        {/* USER */}

                        {message.role ===
                          "user" && (
                          <span
                            className="
                              flex
                              h-7
                              w-7
                              shrink-0
                              items-center
                              justify-center

                              rounded-lg

                              bg-[#FFF0E2]

                              text-[9px]
                              text-[#FF7A00]
                            "
                          >
                            <FaUser />
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )
                )}

                {/* =================================================
                    TYPING
                ================================================= */}

                {typing && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: 8,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    className="
                      flex
                      items-end
                      gap-2
                    "
                  >
                    <span
                      className="
                        flex
                        h-7
                        w-7
                        items-center
                        justify-center

                        rounded-lg

                        bg-[#FF7A00]

                        text-[10px]
                        text-white
                      "
                    >
                      <FaRobot />
                    </span>

                    <div
                      className="
                        flex
                        items-center
                        gap-1

                        rounded-2xl
                        rounded-bl-md

                        border
                        border-[#FF7A00]/10

                        bg-white

                        px-3
                        py-3

                        shadow-sm
                      "
                    >
                      {[0, 1, 2].map(
                        (dot) => (
                          <motion.span
                            key={dot}
                            animate={{
                              y: [
                                0,
                                -4,
                                0,
                              ],
                            }}
                            transition={{
                              duration:
                                0.8,
                              repeat:
                                Infinity,
                              delay:
                                dot *
                                0.15,
                            }}
                            className="
                              h-1.5
                              w-1.5

                              rounded-full

                              bg-[#FF7A00]
                            "
                          />
                        )
                      )}
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* =================================================
                INPUT AREA
            ================================================= */}

            <div
              className="
                border-t
                border-[#FF7A00]/10

                bg-white

                p-3
              "
            >
              <div
                className="
                  flex
                  items-end
                  gap-2

                  rounded-2xl

                  border
                  border-[#FF7A00]/15

                  bg-[#FFF9F5]

                  p-1.5

                  transition-all
                  duration-300

                  focus-within:border-[#FF7A00]

                  focus-within:bg-white

                  focus-within:shadow-[0_0_0_3px_rgba(255,122,0,0.06)]
                "
              >
                <textarea
                  rows={1}
                  value={input}
                  onChange={(event) =>
                    setInput(
                      event.target.value
                    )
                  }
                  onKeyDown={(
                    event
                  ) => {
                    if (
                      event.key ===
                        "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();

                      handleSend();
                    }
                  }}
                  placeholder="Ask about Dholera properties..."
                  className="
                    max-h-24
                    min-h-9.5

                    flex-1

                    resize-none

                    bg-transparent

                    px-2
                    py-2

                    text-[11px]
                    leading-5

                    text-gray-700

                    outline-none

                    placeholder:text-gray-400

                    sm:text-[12px]
                  "
                />

                <motion.button
                  type="button"
                  onClick={() =>
                    handleSend()
                  }
                  disabled={
                    !input.trim() ||
                    typing
                  }
                  whileHover={
                    input.trim() &&
                    !typing
                      ? {
                          scale:
                            1.05,
                        }
                      : undefined
                  }
                  whileTap={
                    input.trim() &&
                    !typing
                      ? {
                          scale:
                            0.92,
                        }
                      : undefined
                  }
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center

                    rounded-xl

                    bg-[#FF7A00]

                    text-white

                    shadow-[0_5px_15px_rgba(255,122,0,0.20)]

                    transition-all
                    duration-300

                    hover:bg-[#FF9638]

                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  "
                >
                  <FaArrowUp size={11} />
                </motion.button>
              </div>

              {/* =================================================
                  BOTTOM BAR
              ================================================= */}

              <div
                className="
                  mt-2

                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >
                <button
                  type="button"
                  onClick={clearChat}
                  className="
                    text-[8px]
                    font-semibold

                    text-gray-400

                    transition-colors
                    duration-300

                    hover:text-[#FF7A00]
                  "
                >
                  Clear conversation
                </button>

                <span
                  className="
                    flex
                    items-center
                    gap-1

                    text-[8px]

                    text-gray-400
                  "
                >
                  <FaBuilding />

                  Omana Projects
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}