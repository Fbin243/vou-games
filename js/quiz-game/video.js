const video = document.getElementById("video")
const hiddenVideo = document.getElementById("hidden-video")
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
}

export default new Video()