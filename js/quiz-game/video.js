const video = document.querySelector(".video")
const hiddenVideo = document.querySelector(".hidden-video")
video.style.display = 'none'
hiddenVideo.style.display = 'none'

class Video {
    startSpeaking() {
        hiddenVideo.style.display = 'none'
        video.style.display = 'block'
        hiddenVideo.pause()
        hiddenVideo.currentTime = 0
        video.play()
    }

    stopSpeaking() {
        video.style.display = 'none'
        hiddenVideo.style.display = 'block'
        video.pause()
        video.currentTime = 0
        hiddenVideo.play()
    }

    displayStatic() {
        hiddenVideo.style.display = 'none'
        video.style.display = 'block'
        video.currentTime = 0
        video.pause()
    }
}

export default new Video()