import fade from "./fade.js";
import Video from "./video.js";

const scoreElement = document.querySelector("#score");
const questionNumberElement = document.querySelector("#question-number");
const triviaContainer = document.querySelector("#trivia-container");
const triviaQuestion = document.querySelector(".trivia-item__question")
const triviaAnswers = document.querySelectorAll(".trivia-item__button")
const connectBtn = document.getElementById('start-session-btn')
const startGameBtn = document.getElementById('send-msg-btn')
const time = document.getElementById('time')
const audio = document.getElementById("audio")
let score = 0;
let quizIndex = 0;
let quizzes = []
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
let selectedAnswerTarget

playerId = 1
eventId = 2
gameId = 3
sessionId = "669fedc17ada690bd952c608"

let quizResponse = `{
    "responseCode": 0,
    "results": [
        {
            "type": "multiple",
            "difficulty": "easy",
            "question": "Which of the following countries was not an axis power during World War II?",
            "correct_answer": " Soviet Union",
            "incorrect_answers": [
                "Italy",
                "Germany",
                "Japan"
            ],
            "correct_answer_index": 1,
            "audio_url": "https://voubucket.s3.amazonaws.com/questions/669fedc17ada690bd952c607/1.mp3"
        },
        {
            "type": "multiple",
            "difficulty": "medium",
            "question": "What is the largest Muslim country in the world?",
            "correct_answer": "Indonesia",
            "incorrect_answers": [
                "Pakistan",
                "Saudi Arabia",
                "Iran"
            ],
                "correct_answer_index": 2,
            "audio_url": "https://voubucket.s3.amazonaws.com/questions/669fedc17ada690bd952c607/2.mp3"
        },
        {
            "type": "multiple",
            "difficulty": "hard",
            "question": "Before Super Smash Bros. contained Nintendo characters, what was it known as internally?",
            "correct_answer": "Dragon King: The Fighting Game",
            "incorrect_answers": [
                "Contest of Champions",
                "Smash and Pummel",
                "Fighter of the Ages: Conquest"
            ],
            "correct_answer_index": 0,
            "audio_url": "https://voubucket.s3.amazonaws.com/questions/669fedc17ada690bd952c607/3.mp3"
        }
    ]
}`

quizzes = JSON.parse(quizResponse).results
console.log("quizzes: ", quizzes)
displayQuiz()
setUpEventClickAnswer()

/**
 * UI
 */
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
    });

    const triviaDiv = triviaContainer.querySelector(".trivia-item");
    fade(triviaDiv, "in");
}

function setUpEventClickAnswer() {
    triviaAnswers.forEach((answer, index) => {
        answer.addEventListener("click", onAnswerClicked);
    });
}

function clearQuiz() {
    for (const child of triviaContainer.children) {
        triviaContainer.removeChild(child);
    }
}

function onAnswerClicked(event) {
    selectedAnswerTarget = event.target
    triviaAnswers.forEach((answer) => {
        answer.classList.add("trivia-item__button--disabled");
        answer.disabled = true;
    });

    selectedAnswerTarget.classList.add("trivia-item__button--pending");


    setTimeout(() => {
        showCorrectAnswer()
    }, 10000)
}

function showCorrectAnswer() {
    const selectedAnswer = selectedAnswerTarget.innerText;
    const quiz = quizzes[quizIndex];
    const correctAnswer = quiz.correct_answer;

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
    updateScore(responseBody.totalScore)
    isGameStarted = true;
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

    if (isGameStarted) {
        quizIndex = Math.floor(difference / (gameInfo.duration + 1))
        console.log("onUpdateGameStatus ", quizIndex)
        if (quizIndex >= quizzes.length) {
            isGameStarted = false
            endGame()
        } else {
            if (timeRemain === 30) {
                clearQuiz()
            }
            updateQuestionNumber();
            displayQuiz();
        }
    }
}

function calculateScore() {
    return timeRemain * (baseScore + quizIndex)
}



/**
 * Virtual MC
 */
questionNumberElement.addEventListener("click", function () {
    readQuestion()
})

setUpEventAudioEnd()

function readQuestion() {
    audio.src = quizzes[quizIndex].audio_url
    audio.play()
    Video.startSpeaking()
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

// connectBtn.addEventListener("click", wsConnectGame)
// startGameBtn.addEventListener('click', wsStartGame)
