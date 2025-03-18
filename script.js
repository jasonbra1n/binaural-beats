const modeRadios = document.querySelectorAll('input[name="mode"]');
const sleepOptions = document.getElementById('sleep-options');
const toneOptions = document.getElementById('tone-options');
const stateSelect = document.getElementById('state');
const customFrequencyDiv = document.getElementById('custom-frequency');
const volumeSlider = document.getElementById('volume');
const playButton = document.getElementById('play');
const stopButton = document.getElementById('stop');
const carrierFrequencyInput = document.getElementById('carrier-frequency');
const secondCarrierInput = document.getElementById('second-carrier');
const totalTimeInput = document.getElementById('total-time');
const transitionTimeInput = document.getElementById('transition-time');
const riseTimeInput = document.getElementById('rise-time');
const timelineSlider = document.getElementById('timeline');
const waveCanvas = document.getElementById('wave-canvas');
const ctx = waveCanvas.getContext('2d');

let leftOsc, rightOsc, masterGain, startTime, totalDuration, intervalId;

// Toggle mode options
modeRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    sleepOptions.style.display = radio.value === 'sleep' ? 'block' : 'none';
    toneOptions.style.display = radio.value === 'tone' ? 'block' : 'none';
    updateAudio();
  });
});

// Show/hide custom frequency input
stateSelect.addEventListener('change', () => {
  customFrequencyDiv.style.display = stateSelect.value === 'custom' ? 'block' : 'none';
  updateAudio();
});

// Real-time updates
carrierFrequencyInput.addEventListener('input', updateAudio);
secondCarrierInput.addEventListener('input', updateAudio);
volumeSlider.addEventListener('input', updateVolume);
document.getElementById('custom-hz').addEventListener('input', updateAudio);

// Play audio
playButton.addEventListener('click', async () => {
  await Tone.start();
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const carrier = parseFloat(carrierFrequencyInput.value);
  const volume = volumeSlider.value / 100;

  if (leftOsc) {
    leftOsc.stop();
    rightOsc.stop();
  }

  masterGain = new Tone.Gain(volume).toDestination();

  if (mode === 'sleep') {
    totalDuration = parseInt(totalTimeInput.value) * 60;
    const secondCarrier = parseFloat(secondCarrierInput.value);
    const transitionTime = parseInt(transitionTimeInput.value) * 60;
    const riseTime = parseInt(riseTimeInput.value) * 60;
    const beatFrequency = 2; // Delta for sleep

    leftOsc = new Tone.Oscillator(carrier, 'sine');
    rightOsc = new Tone.Oscillator(carrier + beatFrequency, 'sine');

    const leftPanner = new Tone.Panner(-1).connect(masterGain);
    const rightPanner = new Tone.Panner(1).connect(masterGain);
    leftOsc.connect(leftPanner);
    rightOsc.connect(rightPanner);

    leftOsc.start();
    rightOsc.start();

    scheduleSleepCycle(transitionTime, riseTime, totalDuration, carrier, secondCarrier, beatFrequency);
    startTime = Tone.now();
    updateTimeline();
    visualizeSleepCycle();
  } else {
    const state = stateSelect.value;
    let beatFrequency = state === 'custom' ? parseFloat(document.getElementById('custom-hz').value) : parseFloat(state);

    leftOsc = new Tone.Oscillator(carrier, 'sine');
    rightOsc = new Tone.Oscillator(carrier + beatFrequency, 'sine');

    const leftPanner = new Tone.Panner(-1).connect(masterGain);
    const rightPanner = new Tone.Panner(1).connect(masterGain);
    leftOsc.connect(leftPanner);
    rightOsc.connect(rightPanner);

    leftOsc.start();
    rightOsc.start();

    visualizeBeatFrequency(beatFrequency);
  }
});

// Stop audio
stopButton.addEventListener('click', () => {
  if (leftOsc) {
    masterGain.gain.rampTo(0, 2);
    setTimeout(() => {
      leftOsc.stop();
      rightOsc.stop();
      leftOsc = null;
      rightOsc = null;
      clearInterval(intervalId);
      timelineSlider.value = 0;
    }, 2000);
  }
});

// Update audio parameters
function updateAudio() {
  if (leftOsc && rightOsc) {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const carrier = parseFloat(carrierFrequencyInput.value);
    let beatFrequency;

    if (mode === 'sleep') {
      const elapsed = Tone.now() - startTime;
      const transitionTime = parseInt(transitionTimeInput.value) * 60;
      const riseTime = parseInt(riseTimeInput.value) * 60;
      const totalDuration = parseInt(totalTimeInput.value) * 60;
      const secondCarrier = parseFloat(secondCarrierInput.value);
      beatFrequency = 2; // Delta
      leftOsc.frequency.value = getCurrentCarrier(elapsed, transitionTime, riseTime, totalDuration, carrier, secondCarrier);
    } else {
      const state = stateSelect.value;
      beatFrequency = state === 'custom' ? parseFloat(document.getElementById('custom-hz').value) : parseFloat(state);
      leftOsc.frequency.value = carrier;
    }
    rightOsc.frequency.value = leftOsc.frequency.value + beatFrequency;
  }
}

// Update volume
function updateVolume() {
  const volume = volumeSlider.value / 100;
  if (masterGain) masterGain.gain.value = volume;
}

// Schedule sleep cycle carrier changes
function scheduleSleepCycle(transitionTime, riseTime, totalDuration, startCarrier, secondCarrier, beatFrequency) {
  leftOsc.frequency.setValueAtTime(startCarrier, Tone.now());
  leftOsc.frequency.linearRampTo(secondCarrier, transitionTime, Tone.now());
  leftOsc.frequency.setValueAtTime(secondCarrier, Tone.now() + totalDuration - riseTime);
  leftOsc.frequency.linearRampTo(startCarrier, riseTime, Tone.now() + totalDuration - riseTime);

  rightOsc.frequency.setValueAtTime(startCarrier + beatFrequency, Tone.now());
  rightOsc.frequency.linearRampTo(secondCarrier + beatFrequency, transitionTime, Tone.now());
  rightOsc.frequency.setValueAtTime(secondCarrier + beatFrequency, Tone.now() + totalDuration - riseTime);
  rightOsc.frequency.linearRampTo(startCarrier + beatFrequency, riseTime, Tone.now() + totalDuration - riseTime);
}

// Update timeline
function updateTimeline() {
  intervalId = setInterval(() => {
    if (leftOsc) {
      const elapsed = Tone.now() - startTime;
      const progress = (elapsed / totalDuration) * 100;
      timelineSlider.value = Math.min(progress, 100);
      if (progress >= 100) clearInterval(intervalId);
    }
  }, 1000);
}

// Handle timeline interaction
timelineSlider.addEventListener('input', () => {
  if (leftOsc) {
    const progress = parseFloat(timelineSlider.value);
    const newTime = (progress / 100) * totalDuration;
    startTime = Tone.now() - newTime;
    updateAudio();
  }
});

// Calculate current carrier frequency
function getCurrentCarrier(elapsed, transitionTime, riseTime, totalDuration, startCarrier, secondCarrier) {
  if (elapsed < transitionTime) {
    return startCarrier + (secondCarrier - startCarrier) * (elapsed / transitionTime);
  } else if (elapsed < totalDuration - riseTime) {
    return secondCarrier;
  } else {
    const timeLeft = totalDuration - elapsed;
    return secondCarrier + (startCarrier - secondCarrier) * (1 - timeLeft / riseTime);
  }
}

// Visualize constant beat frequency
function visualizeBeatFrequency(beatFrequency) {
  let phase = 0;
  function draw() {
    requestAnimationFrame(draw);
    phase += 0.01;
    ctx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    ctx.beginPath();
    for (let x = 0; x < waveCanvas.width; x++) {
      const y = waveCanvas.height / 2 + Math.sin(x * 0.01 * beatFrequency + phase) * 50;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
  draw();
}

// Visualize sleep cycle
function visualizeSleepCycle() {
  function draw() {
    requestAnimationFrame(draw);
    ctx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    const elapsed = Tone.now() - startTime;
    const beatFrequency = 2; // Delta
    ctx.beginPath();
    for (let x = 0; x < waveCanvas.width; x++) {
      const time = (x / waveCanvas.width) * totalDuration;
      const carrier = getCurrentCarrier(time, parseInt(transitionTimeInput.value) * 60, parseInt(riseTimeInput.value) * 60, totalDuration, parseFloat(carrierFrequencyInput.value), parseFloat(secondCarrierInput.value));
      const y = waveCanvas.height / 2 + Math.sin(x * 0.01 * beatFrequency) * (carrier / 1000) * 50;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Current position indicator
    const progress = (elapsed / totalDuration) * waveCanvas.width;
    ctx.beginPath();
    ctx.moveTo(progress, 0);
    ctx.lineTo(progress, waveCanvas.height);
    ctx.strokeStyle = '#ff0000';
    ctx.stroke();
  }
  draw();
}
