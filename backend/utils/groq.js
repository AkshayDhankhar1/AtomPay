const Groq = require("groq-sdk");

const MODEL = "llama-3.1-8b-instant";

// Lazy initialization — avoids crashing at import time when GROQ_API_KEY
// is not set (e.g., during tests that don't use the AI endpoint)
let _groq = null;
const getClient = () => {
    if (!_groq) {
        _groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
    }
    return _groq;
};

/**
 * Send a chat completion request to Groq with streaming.
 * @param {string} systemPrompt - The system context prompt
 * @param {Array} messages - Array of { role, content } message objects
 * @returns {AsyncIterable} - Stream of completion chunks
 */
const streamChat = async (systemPrompt, messages) => {
    const stream = await getClient().chat.completions.create({
        model: MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            ...messages
        ],
        temperature: 0.7,
        max_tokens: 1024,
        stream: true
    });
    return stream;
};

/**
 * Non-streaming chat for simpler use cases
 */
const chat = async (systemPrompt, messages) => {
    const response = await getClient().chat.completions.create({
        model: MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            ...messages
        ],
        temperature: 0.7,
        max_tokens: 1024
    });
    return response.choices[0]?.message?.content || "";
};

module.exports = { streamChat, chat, MODEL };
