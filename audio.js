/* ============================================
   FLUENCY LAB — AUDIO MODULE
   Recording, playback, and transcription
   ============================================ */

const AUDIO = {
  recorder: null,
  stream: null,
  chunks: [],
  isRecording: false,
  startTime: null,
  timerInterval: null,

  // ─── RECORDING ────────────────────────────
  async startRecording(options = {}) {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });

      this.chunks = [];
      this.recorder = new MediaRecorder(this.stream, {
        mimeType: this.getSupportedMimeType(),
      });

      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.recorder.onstop = async () => {
        const blob = new Blob(this.chunks, { type: this.getSupportedMimeType() });
        this.stopStream();
        if (options.onComplete) {
          await options.onComplete(blob);
        }
      };

      this.recorder.start(100); // Collect in 100ms chunks
      this.isRecording = true;
      this.startTime = Date.now();

      // Start timer
      if (options.timerEl) {
        this.startTimer(options.timerEl, options.maxSeconds);
      }

      // Auto-stop if maxSeconds set
      if (options.maxSeconds) {
        setTimeout(() => {
          if (this.isRecording) this.stopRecording();
        }, options.maxSeconds * 1000);
      }

      return true;
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        TOAST.show('Microphone permission denied. Please allow access.', 'error');
      } else {
        TOAST.show('Could not start recording. Please try again.', 'error');
      }
      console.error('Recording error:', err);
      return false;
    }
  },

  stopRecording() {
    if (this.recorder && this.isRecording) {
      this.recorder.stop();
      this.isRecording = false;
      this.stopTimer();
    }
  },

  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  },

  getDuration() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  },

  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
  },

  // ─── TIMER ────────────────────────────────
  startTimer(el, maxSeconds = null) {
    let elapsed = 0;
    this.timerInterval = setInterval(() => {
      elapsed++;
      const display = maxSeconds
        ? this.formatTime(maxSeconds - elapsed) // countdown
        : this.formatTime(elapsed);             // countup
      el.textContent = display;

      if (maxSeconds && elapsed >= maxSeconds) {
        this.stopTimer();
      }
    }, 1000);
  },

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  formatTime(seconds) {
    const m = Math.floor(Math.abs(seconds) / 60).toString().padStart(2, '0');
    const s = (Math.abs(seconds) % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  },

  // ─── PLAYBACK ─────────────────────────────
  createAudioURL(blob) {
    return URL.createObjectURL(blob);
  },

  play(url, options = {}) {
    const audio = new Audio(url);

    audio.onplay    = () => options.onPlay?.();
    audio.onended   = () => options.onEnd?.();
    audio.onpause   = () => options.onPause?.();
    audio.ontimeupdate = () => options.onTimeUpdate?.(audio.currentTime, audio.duration);

    audio.play().catch(err => {
      console.error('Playback error:', err);
      TOAST.show('Could not play audio.', 'error');
    });

    return audio;
  },

  // ─── TRANSCRIPTION ────────────────────────
  async transcribe(blob) {
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      // Calls Cloudflare Worker which calls Whisper
      const res = await fetch('/workers/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Transcription failed');
      const data = await res.json();
      return data.text || '';
    } catch (err) {
      console.error('Transcription error:', err);
      return null;
    }
  },

  // ─── WAVEFORM VISUALIZER ──────────────────
  startVisualizer(canvas, stream) {
    const ctx = canvas.getContext('2d');
    const analyser = new (window.AudioContext || window.webkitAudioContext)()
      .createAnalyser();
    const source = analyser.context.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!this.isRecording) return;
      requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(0, 229, 195, ${0.3 + (dataArray[i] / 255) * 0.7})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
  },

  // ─── RECORD BUTTON HELPER ─────────────────
  bindRecordButton(btnEl, options = {}) {
    let audioBlob = null;
    let audioURL = null;
    let audioPlayer = null;

    const onStart = () => {
      btnEl.classList.add('recording');
      btnEl.innerHTML = ICONS.stop;
      options.onStart?.();
    };

    const onStop = async (blob) => {
      audioBlob = blob;
      audioURL = this.createAudioURL(blob);
      btnEl.classList.remove('recording');
      btnEl.innerHTML = ICONS.play;

      // Auto-transcribe if requested
      if (options.transcribe) {
        TOAST.show('Transcribing...', 'info');
        const text = await this.transcribe(blob);
        options.onTranscript?.(text);
      }

      options.onStop?.(blob, audioURL);
    };

    btnEl.addEventListener('click', async () => {
      if (this.isRecording) {
        this.stopRecording();
        return;
      }

      // If already recorded, play back
      if (audioURL && !this.isRecording) {
        if (audioPlayer && !audioPlayer.paused) {
          audioPlayer.pause();
          btnEl.innerHTML = ICONS.play;
        } else {
          audioPlayer = this.play(audioURL, {
            onEnd: () => { btnEl.innerHTML = ICONS.play; },
          });
          btnEl.innerHTML = ICONS.pause;
        }
        return;
      }

      // Start fresh recording
      onStart();
      await this.startRecording({
        onComplete: onStop,
        timerEl: options.timerEl,
        maxSeconds: options.maxSeconds,
      });
    });

    return {
      getBlob: () => audioBlob,
      getURL:  () => audioURL,
      reset:   () => {
        audioBlob = null;
        audioURL = null;
        audioPlayer = null;
        btnEl.classList.remove('recording');
        btnEl.innerHTML = ICONS.mic;
      }
    };
  },
};

// ─── SVG ICONS ────────────────────────────────
const ICONS = {
  mic: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>`,

  stop: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
  </svg>`,

  play: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>`,

  pause: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16"/>
    <rect x="14" y="4" width="4" height="16"/>
  </svg>`,

  chevronRight: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>`,

  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`,
};

window.AUDIO = AUDIO;
window.ICONS = ICONS;
