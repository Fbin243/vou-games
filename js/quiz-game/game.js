import fade from "./fade.js";
import shuffle from "./shuffle.js";

const scoreElement = document.querySelector("#score");
const questionNumberElement = document.querySelector("#question-number");
const triviaContainer = document.querySelector("#trivia-container");
const triviaItemTemplate = document.querySelector("#trivia-item-template");
const triviaItemTemplateMultipleChoice = document.querySelector("#trivia-item-template-multiple-choice");
const connectBtn = document.getElementById('start-session-btn')
const startGameBtn = document.getElementById('send-msg-btn')
const time = document.getElementById('time')
const video = document.getElementById("video")
const hiddeSource = document.getElementById("hidden-source")
const hiddenVideo = document.getElementById("hidden-video")
let score = 0;
let triviaItemIndex = 0;
let triviaItems = []
let gameInfo = {
    name: "HQ Trivia",
    number_of_questions: 20,
    duration: 30,
    startTime: 1722008240 - 1 * 30,
}
let socket, stompClient
let isGameStarted = false
let playerId
let eventId
let gameId
let sessionId
let timeRemain
let difference
let leaderboard
let baseScore = 10

playerId = 1
eventId = 2
gameId = 3
sessionId = "669fedc17ada690bd952c606"

video.style.display = 'none'
hiddenVideo.style.display = 'none'

questionNumberElement.addEventListener("click", function () {
    console.log("Start video")
    startSpeaking()
})

time.addEventListener("click", function () {
    console.log("Stop video")
    stopSpeaking()
})

function startSpeaking() {
    hiddenVideo.style.display = 'none'
    video.style.display = 'block'
    video.currentTime = 0
    video.play()
}

function stopSpeaking() {
    video.style.display = 'none'
    hiddenVideo.style.display = 'block'
    hiddenVideo.currentTime = 0
    hiddenVideo.play()
}

// Keep our score variable in sync with the UI.
function updateScore(newScore) {
    const shouldAnimate = score !== newScore;
    score = newScore;
    scoreElement.textContent = score;

    // === Bonus Demo ===
    // Animate the score changing to draw the eye to the score.
    if (shouldAnimate) {
        const scoreContainerElement = scoreElement.parentElement;
        const keyframes = [
            {transform: "scale(1)"},
            {transform: "scale(1.2) rotate(5deg)"},
            {transform: "scale(1)"},
        ];
        const options = {
            duration: 500,
            iterations: 2,
            easing: "ease-in-out",
        };
        scoreContainerElement.animate(keyframes, options);
    }
}

// Keep our index in sync with the UI.
function updateQuestionNumber() {
    const questionNum = triviaItemIndex + 1;
    const totalNumQuestions = triviaItems.length;
    questionNumberElement.textContent = `${questionNum}/${gameInfo.number_of_questions}`;
}

// Clone our template and fill it in with a trivia item.
function displayTriviaItem() {
    const triviaItem = triviaItems[triviaItemIndex];
    if (!triviaItem) return;

    // Object destructuring with renaming properties:
    const {
        question,
        correct_answer: correctAnswer,
        incorrect_answers: incorrectAnswers,
    } = triviaItem;

    const allAnswers = shuffle([correctAnswer, ...incorrectAnswers])

    let triviaItemElement = triviaItemTemplate.content.cloneNode(true);
    if (allAnswers.length === 4)
        triviaItemElement = triviaItemTemplateMultipleChoice.content.cloneNode(true);

    const questionElement = triviaItemElement.querySelector(".trivia-item__question");
    questionElement.innerHTML = question;

    const buttonElements = triviaItemElement.querySelectorAll(".trivia-item__button");
    buttonElements.forEach((button, index) => {
        button.innerHTML = allAnswers[index];
        button.addEventListener("click", onAnswerClicked);
    });

    if (triviaContainer.children.length > 0) return;
    triviaContainer.appendChild(triviaItemElement);
    const triviaDiv = triviaContainer.querySelector(".trivia-item");
    fade(triviaDiv, "in");
}

// Check if the answer picked was correct or incorrect.
function onAnswerClicked(event) {
    const target = event.target;
    const selectedAnswer = target.innerText;
    const triviaItem = triviaItems[triviaItemIndex];
    const correctAnswer = triviaItem.correct_answer;

    const buttonElements = triviaContainer.querySelectorAll(".trivia-item__button");
    buttonElements.forEach((button) => {
        button.disabled = true;
        button.classList.add("trivia-item__button--disabled");
    });

    if (selectedAnswer === correctAnswer) {
        console.log("Correct!");
        updateScore(score + calculateScore());
        target.classList.add("trivia-item__button--correct");
        // Update score to server
        updateGame()
    } else {
        console.log("Incorrect!");
        target.classList.add("trivia-item__button--incorrect");
    }
}

// Clearing trivia items from the page.
function clearTrivia() {
    for (const child of triviaContainer.children) {
        triviaContainer.removeChild(child);
    }
}

connectBtn.addEventListener("click", connect)
startGameBtn.addEventListener('click', startGame)

function connect() {
    socket = new SockJS('http://localhost:8081/ws');
    stompClient = Stomp.over(socket);

    stompClient.connect({}, onConnection, onError);
}

function onConnection() {
    // Subcribe to the time topic
    stompClient.subscribe(`/topic/time/${sessionId}`, onUpdateGameStatus);
    stompClient.subscribe(`/topic/connection/${sessionId}`, onUpdateConnection);
    stompClient.subscribe(`topic/leaderboard/${sessionId}`, onUpdateLeaderboard);

    // Get number of connection
    stompClient.send("/app/game", {}, JSON.stringify({
        type: "CONNECTION",
        payload: JSON.stringify(
            {
                playerId: playerId,
                sessionId: sessionId,
            })
    }));
}

function startGame() {
    stompClient.subscribe(`/topic/start/${playerId}`, onStartGame);

    stompClient.send('/app/game', {}, JSON.stringify({
        type: "START",
        payload: JSON.stringify({
            playerId: playerId,
            sessionId: sessionId,
        })
    }))
}

function updateGame() {
    stompClient.send('/app/game', {}, JSON.stringify({
        type: "UPDATE",
        payload: JSON.stringify({
            playerId: playerId,
            sessionId: sessionId,
            score: score,
        })
    }))
}

function onStartGame(message) {
    console.log("Saving trivia items...", message.body)
    let responseBody = JSON.parse(message.body)
    triviaItems = responseBody.quizResponse.results
    updateScore(responseBody.totalScore)
    isGameStarted = true;
}

function onUpdateLeaderboard(message) {
    console.log(message.body)
}

function onUpdateGameStatus(message) {
    difference = parseInt(message.body) - gameInfo.startTime
    timeRemain = gameInfo.duration - difference % (gameInfo.duration + 1);
    time.innerText = timeRemain

    if (isGameStarted) {
        triviaItemIndex = Math.floor(difference / (gameInfo.duration + 1))
        console.log("onUpdateGameStatus ", triviaItemIndex)
        if (triviaItemIndex >= triviaItems.length) {
            isGameStarted = false
            endGame()
        } else {
            if (timeRemain === 30) {
                clearTrivia()
            }
            updateQuestionNumber();
            displayTriviaItem();
        }
    }
}

function endGame() {
    const triviaDiv = triviaContainer.querySelector(".trivia-item");
    const animation = fade(triviaDiv, "out", {delay: 500});
    animation.addEventListener("finish", () => {
        clearTrivia()
        const html = `
          <p class="game-over-message">Game over. Your final score is ${score}.</p>
        `;
        triviaContainer.insertAdjacentHTML("beforeend", html);

        const gameOverMessage = triviaContainer.querySelector(".game-over-message");
        fade(gameOverMessage, "in");
    });
}

function onError(message) {
    console.log('error connect websocket', message.body);
}

function onUpdateConnection(message) {
    connectBtn.innerText = message.body;
}

function calculateScore() {
    // Score will be calculated according to this formula: timeRemain * (baseScore + question's number)
    return timeRemain * (baseScore + triviaItemIndex)
}
