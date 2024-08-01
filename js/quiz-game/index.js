import fade from "./fade.js";
import Video from "./video.js";

const scoreElement = document.querySelector("#score");
const questionNumberElement = document.querySelector("#question-number");
const triviaContainer = document.querySelector("#trivia-container");
const triviaQuestion = document.querySelector(".trivia-item__question")
const triviaAnswers = document.querySelectorAll(".trivia-item__button")
const startGameBtn = document.getElementById("start-game-btn")
const waitingScreen = document.getElementById("waiting-screen")
const playingScreen = document.getElementById("playing-screen")
const connectBtn = document.getElementById('start-session-btn')
const backBtn = document.getElementById("back-btn")
const time = document.getElementById('time')
const audio = document.getElementById("audio")
let score = 0;
let quizIndex = 0;
let quizzes = []
let gameInfo = {
    name: "HQ Trivia",
    number_of_questions: 20,
    duration: 30,
    startTime: Math.floor(Date.now() / 1000),
}
console.log(gameInfo.startTime)
let socket, stompClient
let playerId
let eventId
let gameId
let sessionId
let timeRemain
let difference
let leaderboard
let baseScore = 10
let selectedAnswerTarget

playerId = 1
eventId = 2
gameId = 3
sessionId = "669fedc17ada690bd952c608"

let quizResponse

setUpEventClickAnswer()
wsConnectGame()
handleClickStartGame()

/**
 * UI
 */

function handleClickStartGame() {
    startGameBtn.addEventListener("click", () => {
        console.log("Start game")
        waitingScreen.classList.add("d-none")
        playingScreen.classList.remove("d-none")
        startGameBtn.classList.add("d-none")
        wsStartGame()
    })
}

function displayQuiz() {
    const triviaItem = quizzes[quizIndex];
    if (!triviaItem) return;

    const {
        question,
        correct_answer: correctAnswer,
        incorrect_answers: incorrectAnswers,
        correct_answer_index: correctAnswerIndex
    } = triviaItem;

    const allAnswers = [correctAnswer, ...incorrectAnswers]
    allAnswers[0] = allAnswers[correctAnswerIndex]
    allAnswers[correctAnswerIndex] = correctAnswer

    console.log("question", question)
    triviaQuestion.innerHTML = question;

    triviaAnswers.forEach((answer, index) => {
        answer.innerHTML = allAnswers[index];
        resetStateOfAnswer(answer)
    });

    const triviaDiv = triviaContainer.querySelector(".trivia-item");
    fade(triviaDiv, "in");
}

function resetStateOfAnswer(answer) {
    selectedAnswerTarget = null
    answer.disabled = false
    answer.classList.remove("trivia-item__button--pending")
    answer.classList.remove("trivia-item__button--disabled")
    answer.classList.remove("trivia-item__button--correct")
    answer.classList.remove("trivia-item__button--incorrect")
}

function setUpEventClickAnswer() {
    triviaAnswers.forEach((answer, index) => {
        answer.addEventListener("click", onAnswerClicked);
    });
}

function onAnswerClicked(event) {
    selectedAnswerTarget = event.target
    triviaAnswers.forEach((answer) => {
        answer.classList.add("trivia-item__button--disabled");
        answer.disabled = true;
    });

    selectedAnswerTarget.classList.add("trivia-item__button--pending");
}

function showCorrectAnswer() {
    const quiz = quizzes[quizIndex];
    const correctAnswer = quiz.correct_answer;

    if(selectedAnswerTarget === null) {
        triviaAnswers.forEach((answer) => {
            if(answer.innerText.trim() === correctAnswer.trim()) {
                selectedAnswerTarget = answer
            }
        })
    }

    const selectedAnswer = selectedAnswerTarget.innerText;
    if (selectedAnswer.trim() === correctAnswer.trim()) {
        console.log("Correct!");
        updateScore(score + calculateScore());
        selectedAnswerTarget.classList.add("trivia-item__button--correct");
        // Update score to server
        wsUpdateGame()
    } else {
        console.log("Incorrect!");
        selectedAnswerTarget.classList.add("trivia-item__button--incorrect");
        triviaAnswers[quiz.correct_answer_index].classList.add("trivia-item__button--correct")
    }
}

function updateScore(newScore) {
    const shouldAnimate = score !== newScore;
    score = newScore;
    scoreElement.textContent = score;

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

function updateQuestionNumber() {
    const questionNum = quizIndex + 1;
    const totalNumQuestions = quizzes.length;
    questionNumberElement.textContent = `${questionNum}/${gameInfo.number_of_questions}`;
}

function endGame() {
    const triviaDiv = triviaContainer.querySelector(".trivia-item");
    const animation = fade(triviaDiv, "out", {delay: 500});
    animation.addEventListener("finish", () => {
        clearQuiz()
        const html = `
          <p class="game-over-message">Game over. Your final score is ${score}.</p>
        `;
        triviaContainer.insertAdjacentHTML("beforeend", html);

        const gameOverMessage = triviaContainer.querySelector(".game-over-message");
        fade(gameOverMessage, "in");
    });
}

function onStartGame(message) {
    let responseBody = JSON.parse(message.body)
    quizzes = responseBody.quizResponse.results
    console.log("Quizzes; ", quizzes)
    updateScore(responseBody.totalScore)
    updateQuestionNumber()
    displayQuiz()
    Video.displayStatic()
    if (timeRemain < 30) readQuestion()
    if (timeRemain < 5) readAnswer()
}

function onUpdateLeaderboard(message) {
    console.log(message.body)
}

function onUpdateConnection(message) {
    connectBtn.innerText = message.body;
}

function onUpdateGame(message) {
    difference = parseInt(message.body) - gameInfo.startTime
    timeRemain = gameInfo.duration - difference % (gameInfo.duration + 1);
    time.innerText = timeRemain

    quizIndex = Math.floor(difference / (gameInfo.duration + 1))
    console.log("onUpdateGameStatus ", quizIndex)
    if (quizIndex >= quizzes.length) {
        // endGame()
    } else {
        if (timeRemain === 30) {
            displayQuiz();
            updateQuestionNumber();
            readQuestion();
        } else if (timeRemain === 5) {
            readAnswer();
        }
    }
}

function calculateScore() {
    return timeRemain * (baseScore + quizIndex)
}


/**
 * Virtual MC
 */
setUpEventAudioEnd()

function readQuestion() {
    // TODO: Set 0 for testing
    audio.src = quizzes[quizIndex].audio_url
    console.log("src", audio.src)
    if (30 - timeRemain >= audio.duration) return
    audio.currentTime = 30 - timeRemain
    audio.play()
    Video.startSpeaking()
}

function readAnswer() {
    audio.src = `https://voubucket.s3.amazonaws.com/answers/${incrementChar('A', quizzes[quizIndex].correct_answer_index)}.mp3`
    if (5 - timeRemain < 0) return
    audio.currentTime = 5 - timeRemain
    audio.play()
    Video.startSpeaking()
    setTimeout(showCorrectAnswer, 3000)
}

function incrementChar(char, num) {
    let charCode = char.charCodeAt(0);
    let newCharCode = charCode + num;
    return String.fromCharCode(newCharCode);
}

function setUpEventAudioEnd() {
    audio.addEventListener("ended", () => {
        console.log("Stop video")
        Video.stopSpeaking()
    })
}

/**
 * Websocket set up real-time game
 */
function wsConnectGame() {
    socket = new SockJS('http://localhost:8081/ws');
    stompClient = Stomp.over(socket);

    stompClient.connect({}, onConnectSuccess, onError);
}

function onConnectSuccess() {
    // Subcribe to the time topic
    stompClient.subscribe(`/topic/time/${sessionId}`, onUpdateGame);
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

function onError(message) {
    console.log('error connect websocket', message.body);
}

function wsStartGame() {
    stompClient.subscribe(`/topic/start/${playerId}`, onStartGame);

    stompClient.send('/app/game', {}, JSON.stringify({
        type: "START",
        payload: JSON.stringify({
            playerId: playerId,
            sessionId: sessionId,
        })
    }))
}

function wsUpdateGame() {
    stompClient.send('/app/game', {}, JSON.stringify({
        type: "UPDATE",
        payload: JSON.stringify({
            playerId: playerId,
            sessionId: sessionId,
            score: score,
        })
    }))
}
