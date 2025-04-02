// --- DOM Elements ---
const topicModal = document.getElementById("topic-modal");
const topicInput = document.getElementById("topic-input");
const startChatButton = document.getElementById("start-chat-button");
const topicError = document.getElementById("topic-error");

const chatContainer = document.getElementById("chat-container");
const chatTopicDisplay = document.getElementById("chat-topic-display");
const welcomeTopic = document.getElementById("welcome-topic");
const restartButton = document.getElementById("restart-button");
const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const chatError = document.getElementById("chat-error");
const currentTimeElement = document.getElementById("current-time");

// --- State ---
let currentTopic = "";

// --- Helper Functions ---

/**
 * Gets the current time in HH:MM format
 */
function getCurrentTime() {
  const now = new Date();
  let hours = now.getHours();
  let minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be displayed as 12
  minutes = minutes < 10 ? '0' + minutes : minutes;

  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Auto-resize textarea based on content
 */
function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = (textarea.scrollHeight) + "px";

  // Limit max height
  if (textarea.scrollHeight > 150) {
    textarea.style.overflowY = "auto";
  } else {
    textarea.style.overflowY = "hidden";
  }
}

/**
 * Creates an avatar element
 */
function createAvatar(sender) {
  const avatarDiv = document.createElement("div");
  avatarDiv.className = sender === "user" ? "user-avatar" : "ai-avatar";

  const icon = document.createElement("i");
  icon.className = sender === "user" ? "fas fa-user" : "fas fa-robot";
  avatarDiv.appendChild(icon);

  return avatarDiv;
}

/**
 * Displays a message in the chat box.
 * @param {string} sender - 'user' or 'ai'
 * @param {string} text - The message content
 */
function displayMessage(sender, text) {
  const time = getCurrentTime();

  // Create container
  const messageContainer = document.createElement("div");
  messageContainer.className = `message-container ${sender}-container`;

  // Create avatar
  const avatar = createAvatar(sender);
  messageContainer.appendChild(avatar);

  // Create message
  const messageElement = document.createElement("div");
  messageElement.className = `message ${sender}`;

  // Sanitize text (replace potential HTML)
  const sanitizedText = text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Convert URLs to links
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    // Add paragraph breaks
    .split('\n\n').map(para => `<p>${para}</p>`).join('');

  messageElement.innerHTML = `
    <div class="message-header">
      <span class="sender">${sender === "user" ? "You" : "AI Assistant"}</span>
      <span class="time">${time}</span>
    </div>
    <div class="message-content">${sanitizedText}</div>
  `;

  messageContainer.appendChild(messageElement);
  chatBox.appendChild(messageContainer);

  // Scroll to the bottom with smooth animation
  chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Shows a typing indicator while waiting for AI response
 * @returns {Element} The created indicator element
 */
function showTypingIndicator() {
  const container = document.createElement("div");
  container.className = "message-container ai-container typing-indicator";

  const avatar = createAvatar("ai");
  container.appendChild(avatar);

  const messageElement = document.createElement("div");
  messageElement.className = "message ai";
  messageElement.innerHTML = `
    <div class="message-header">
      <span class="sender">AI Assistant</span>
      <span class="time">${getCurrentTime()}</span>
    </div>
    <div class="message-content">
      <p><i class="typing-animation">Thinking<span>.</span><span>.</span><span>.</span></i></p>
    </div>
  `;

  container.appendChild(messageElement);
  chatBox.appendChild(container);
  chatBox.scrollTop = chatBox.scrollHeight;

  return container;
}

/**
 * Sends message and topic to the backend and displays the AI response.
 * @param {string} message - The user's message.
 */
async function sendMessageToServer(message) {
  if (!currentTopic) {
    chatError.textContent = "Error: No topic selected.";
    return;
  }
  if (!message.trim()) return; // Don't send empty messages

  displayMessage("user", message);
  messageInput.value = ""; // Clear input field immediately
  chatError.textContent = ""; // Clear previous errors

  // Reset textarea height
  messageInput.style.height = "auto";

  // Disable input during processing
  sendButton.disabled = true;
  messageInput.disabled = true;

  // Show typing indicator
  const typingIndicator = showTypingIndicator();

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: message, topic: currentTopic }),
    });

    // Remove typing indicator
    chatBox.removeChild(typingIndicator);

    if (!response.ok) {
      let errorMsg = `HTTP error! Status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        /* Ignore if response body isn't valid JSON */
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    if (data.response) {
      displayMessage("ai", data.response);
    } else if (data.error) {
      chatError.textContent = `AI Error: ${data.error}`;
      displayMessage(
        "ai",
        `Sorry, I encountered an error processing that: ${data.error}`
      );
    } else {
      displayMessage("ai", "Sorry, I received an empty response.");
    }
  } catch (error) {
    console.error("Error sending message:", error);
    chatError.textContent = `Network or Server Error: ${error.message}`;

    // Display error in chat as well
    displayMessage(
      "ai",
      `Sorry, I couldn't connect or process the request. Error: ${error.message}`
    );

    // Remove typing indicator if it's still there after an error
    if (chatBox.contains(typingIndicator)) {
      chatBox.removeChild(typingIndicator);
    }
  } finally {
    sendButton.disabled = false; // Re-enable button
    messageInput.disabled = false;
    messageInput.focus(); // Set focus back to input
  }
}

/**
 * Starts the chat session with the selected topic.
 */
function startChat() {
  const topic = topicInput.value.trim();
  if (!topic) {
    topicError.textContent = "Please enter a topic to start chatting.";
    return;
  }

  currentTopic = topic;
  topicError.textContent = ""; // Clear error

  // Update displayed topic in both places
  chatTopicDisplay.textContent = currentTopic;
  welcomeTopic.textContent = currentTopic;

  // Set current time in welcome message
  currentTimeElement.textContent = getCurrentTime();

  // Clear previous chat messages except welcome message
  chatBox.innerHTML = '';

  // Add welcome message
  const welcomeDiv = document.createElement('div');
  welcomeDiv.className = 'welcome-message';
  welcomeDiv.innerHTML = `
    <div class="ai-avatar">
      <i class="fas fa-robot"></i>
    </div>
    <div class="message ai">
      <div class="message-header">
        <span class="sender">AI Assistant</span>
        <span class="time">${getCurrentTime()}</span>
      </div>
      <div class="message-content">
        <p>Hello! I'm your dedicated assistant for <strong>${currentTopic}</strong>. What would you like to know about this topic?</p>
      </div>
    </div>
  `;
  chatBox.appendChild(welcomeDiv);

  chatError.textContent = ""; // Clear chat errors

  // Switch views with animation
  topicModal.style.animation = "modalExit 0.3s var(--ease) forwards";

  setTimeout(() => {
    topicModal.classList.remove("visible");
    topicModal.classList.add("hidden");
    chatContainer.classList.remove("hidden");

    // Reset modal animation for next time
    topicModal.style.animation = "";

    // Focus the message input
    messageInput.focus();
  }, 300);
}

/**
 * Resets the application to the topic selection state.
 */
function restartChat() {
  currentTopic = "";
  topicInput.value = ""; // Clear topic input
  chatBox.innerHTML = ""; // Clear chat messages
  chatError.textContent = ""; // Clear errors
  topicError.textContent = ""; // Clear errors

  // Switch views
  chatContainer.classList.add("hidden");
  topicModal.classList.remove("hidden");
  topicModal.classList.add("visible");

  topicInput.focus(); // Focus the topic input
}

// --- Event Listeners ---
// Initialize the page
document.addEventListener("DOMContentLoaded", function() {
  // Set textarea auto-resize
  messageInput.addEventListener("input", function() {
    autoResizeTextarea(this);
  });

  // Handle form submissions
  startChatButton.addEventListener("click", startChat);
  topicInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      startChat();
      event.preventDefault();
    }
  });

  // Handle chat interactions
  sendButton.addEventListener("click", () => sendMessageToServer(messageInput.value));
  messageInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      sendMessageToServer(messageInput.value);
      event.preventDefault();
    }
  });

  // Restart chat
  restartButton.addEventListener("click", restartChat);

  // Focus topic input initially
  topicInput.focus();
});
