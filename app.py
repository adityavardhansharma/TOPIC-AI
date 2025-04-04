import os
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Configure the Gemini API
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found in environment variables.")

genai.configure(api_key=api_key)
generation_config = {
    "temperature": 0.7,
    "top_p": 1,
    "top_k": 1,
    "max_output_tokens": 5000,
}

safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {
        "category": "HARM_CATEGORY_HATE_SPEECH",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE",
    },
]

# *** Corrected Model Name ***
# Use the stable 'gemini-1.5-flash-latest' identifier
model = genai.GenerativeModel(
    model_name="gemini-2.0-flash", # Corrected model name
    generation_config=generation_config,
    safety_settings=safety_settings,
)


# --- Routes ---
@app.route("/")
def index():
    """Serves the main HTML page."""
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    """Handles chat messages and interacts with the Gemini API."""
    try:
        data = request.get_json()
        user_message = data.get("message")
        topic = data.get("topic")

        if not user_message or not topic:
            return jsonify({"error": "Message or topic missing"}), 400

        # --- *** Refined Prompt for Broader Topic Understanding *** ---
        # This prompt encourages answering related questions within the topic scope.
        prompt = f"""You are an AI assistant focused on discussing a specific topic.
        The current topic is: "{topic}".

        Your goal is to answer the user's questions helpfully and accurately, as long as they are reasonably related to "{topic}".
        Questions about people, events, concepts, history, or sub-fields within "{topic}" are considered on-topic. anything related to the topic should be answered even if it is partially related. give answers that actually help the user in achieving what they asked. try to give a answer that covers the question as much as possible.

        However, if the user asks a question that is clearly *not* related to "{topic}", you MUST respond *exactly* with the following phrase and nothing else:
        "Sorry, that question is outside my current expertise on {topic}."

        Do not apologize further or offer to discuss other things if the question is off-topic. Just use the specified refusal phrase.

        make sure the answer is well formated and presented in a way that is easy to understand.

        User Question: "{user_message}"

        Your Answer:"""

        try:
            response = model.generate_content(prompt)
            ai_response = response.text.strip()

            if not ai_response and response.prompt_feedback.block_reason:
                 ai_response = f"I cannot provide a response due to safety settings (Reason: {response.prompt_feedback.block_reason})."
            elif not ai_response:
                 ai_response = "Sorry, I couldn't generate a response for that."


        except Exception as api_error:
            print(f"Gemini API Error: {api_error}")

            try:
                if response and response.prompt_feedback and response.prompt_feedback.block_reason:
                     return jsonify({"response": f"Blocked by API safety settings: {response.prompt_feedback.block_reason}"})
            except Exception:
                pass # Ignore errors trying to access response details after an error

            return jsonify({"error": "Failed to get response from AI model"}), 500


        return jsonify({"response": ai_response})

    except Exception as e:
        # Log the full error server-side for debugging
        print(f"Error during chat processing: {e}", flush=True)
        # Provide a generic error to the client for security
        return jsonify({"error": "An internal server error occurred"}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)

