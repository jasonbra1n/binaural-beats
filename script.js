const modeRadios = document.querySelectorAll('input[name="mode"]');
const sleepOptions = document.getElementById('sleep-options');
const toneOptions = document.getElementById('tone-options');
const stateSelect = document.getElementById('state');
const customFrequencyInput = document.getElementById('custom-hz');
const volumeSlider = document.getElementById('volume');
const playButton = document.getElementById('play');
const stopButton = document.getElementById('stop');
const carrierFrequencyInput = document.getElementById('carrier-frequency');
const secondCarrierInput = document.getElementById('second-carrier');
const totalTimeInput = document.getElementById('total-time');
const transitionTimeInput = document.getElementById('transition-time');
const riseTimeInput = document.getElementById('rise-time');
const timelineSlider = document.getElementById('timeline');
const panningCheckbox = document.getElementById('panning');
const waveCanvas = document.getElementById('wave-canvas');
const ctx = waveCanvas.getContext('2d');

let leftOsc, rightOsc, leftGain, rightGain, lfoLeft, lfoRight, masterGain, startTime, totalDuration, intervalId, beatFrequencies = [];

// Toggle mode options
modeRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    sleepOptions.style.display = radio.value === 'sleep' ? 'block' : 'none';
    toneOptions.style.display = radio.value === 'tone' ? 'block' : 'none';
    updateAudio();
  });
});

// Real-time updates
carrierFrequencyInput.addEventListener('input', updateAudio);
secondCarrierInput.addEventListener('input', updateAudio);
volumeSlider.addEventListener('input', updateVolume);
stateSelect.addEventListener('change', updateAudio);
customFrequencyInput.addEventListener('input', updateAudio);
panningCheckbox.addEventListener('change', updateAudio);

// Play audio
playButton.addEventListener('click', async () => {
  await Tone.start();
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const carrier = parseFloat(carrierFrequencyInput.value) || 200;
  const volume = volumeSlider.value / 100;

  if (leftOsc) {
    leftOsc.stop();
    rightOsc.stop();
    lfoLeft?.stop();
    lfoRight?.stop();
  }

  masterGain = new Tone.Gain(volume).toDestination();
  leftGain = new Tone.Gain(1);
  rightGain = new Tone.Gain(1);

  if (mode === 'sleep') {
    totalDuration = parseInt(totalTimeInput.value) * 60;
    const secondCarrier = parseFloat(secondCarrierInput.value) || 150;
    const transitionTime = parseInt(transitionTimeInput.value) * 60;
    const riseTime = parseInt(riseTimeInput.value) * 60;
    beatFrequencies = [2]; // Delta for sleep

    leftOsc = new Tone.Oscillator(carrier, 'sine');
    rightOsc = new Tone.Oscillator(carrier + beatFrequencies[0], 'sine');

    const leftPanner = new Tone.Panner(-1).connect(masterGain);
    const rightPanner = new Tone.Panner(1).connect(masterGain);
    leftOsc.connect(leftGain).connect(leftPanner);
    rightOsc.connect(rightGain).connect(rightPanner);

    // Setup LFOs for panning
    lfoLeft = new Tone.LFO(beatFrequencies[0], 0.5, 1).start();
    lfoRight = new Tone.LFO(beatFrequencies[0], 0.5, 1).start();
    lfoRight.phase = 180;

    leftOsc.start();
    rightOsc.start();

    scheduleSleepCycle(transitionTime, riseTime, totalDuration, carrier, secondCarrier);
    startTime = Tone.now();
    updateTimeline();
    visualizeSleepCycle();
  } else {
    const selectedStates = Array.from(stateSelect.selectedOptions).map(option => parseFloat(option.value));
    const customFrequency = parseFloat(customFrequencyInput.value) || 10;
    beatFrequencies = selectedStates.length ? selectedStates : [customFrequency];

    leftOsc = new Tone.Oscillator(carrier, 'sine');
    rightOsc = new Tone.Oscillator(carrier + Math.max(...beatFrequencies), 'sine');

    const leftPanner = new Tone.Panner(-1).connect(masterGain);
    const rightPanner = new Tone.Panner(1).connect(masterGain);
    leftOsc.connect(leftGain).connect(leftPanner);
    rightOsc.connect(rightGain).connect(rightPanner);

    // Setup LFOs for panning
    lfoLeft = new Tone.LFO(Math.max(...beatFrequencies), 0.5, 1).start();
    lfoRight = new Tone.LFO(Math.max(...beatFrequencies), 0.5, 1).start();
    lfoRight.phase = 180;

    leftOsc.start();
    rightOsc.start();

    visualizeBeatFrequencies(beatFrequencies);
  }

  updateAudio();
});

// Stop audio
stopButton.addEventListener('click', () => {
  if (leftOsc) {
    masterGain.gain.rampTo(0, 2);
    setTimeout(() => {
      leftOsc.stop();
      rightOsc.stop();
      lfoLeft?.stop();
      lfoRight?.stop();
      leftOsc = null;
      rightOsc = null;
      lfoLeft = null;
      lfoRight = null;
      clearInterval(intervalId);
      timelineSlider.value = 0;
    }, 2000);
  }
});

// Update audio parameters
function updateAudio() {
  if (leftOsc && rightOsc) {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const carrier = parseFloat(carrierFrequencyInput.value) || 200;
    const panningEnabled = panningCheckbox.checked;
    let beatFrequency;

    if (mode === 'sleep') {
      const elapsed = Tone.now() - startTime;
      const transitionTime = parseInt(transitionTimeInput.value) * 60;
      const riseTime = parseInt(riseTimeInput.value) * 60;
      const totalDuration = parseInt(totalTimeInput.value) * 60;
      const secondCarrier = parseFloat(secondCarrierInput.value) || 150;
      beatFrequency = 2; // Delta
      const currentCarrier = getCurrentCarrier(elapsed, transitionTime, riseTime, totalDuration, carrier, secondCarrier);
      leftOsc.frequency.value = currentCarrier;
      rightOsc.frequency.value = currentCarrier + beatFrequency;

      if (panningEnabled) {
        lfoLeft.frequency.value = beatFrequency;
        lfoRight.frequency.value = beatFrequency;
        lfoLeft.connect(leftGain.gain);
        lfoRight.connect(rightGain.gain);
      } else {
        lfoLeft.disconnect();
        lfoRight.disconnect();
        leftGain.gain.value = 1;
        rightGain.gain.value = 1;
      }
    } else {
      const selectedStates = Array.from(stateSelect.selectedOptions).map(option => parseFloat(option.value));
      const customFrequency = parseFloat(customFrequencyInput.value) || 10;
      beatFrequencies = selectedStates.length ? selectedStates : [customFrequency];
      beatFrequency = Math.max(...beatFrequencies); // Use max for simplicity
      leftOsc.frequency.value = carrier;
      rightOsc.frequency.value = carrier + beatFrequency;

      if (panningEnabled) {
        lfoLeft.frequency.value = beatFrequency;
        lfoRight.frequency.value = beatFrequency;
        lfoLeft.connect(leftGain.gain);
        lfoRight.connect(rightGain.gain);
      } else {
        lfoLeft.disconnect();
        lfoRight.disconnect();
        leftGain.gain.value = 1;
        rightGain.gain.value = 1;
      }
    }
  }
}

// Update volume
function updateVolume() {
  const volume = volumeSlider.value / 100;
  if (masterGain) masterGain.gain.value = volume;
}

// Schedule sleep cycle carrier changes
function scheduleSleepCycle(transitionTime, riseTime, totalDuration, startCarrier, secondCarrier) {
  leftOsc.frequency.setValueAtTime(startCarrier, Tone.now());
  leftOsc.frequency.linearRampTo(secondCarrier, transitionTime, Tone.now());
  leftOsc.frequency.setValueAtTime(secondCarrier, Tone.now() + totalDuration - riseTime);
  leftOsc.frequency.linearRampTo(startCarrier, riseTime, Tone.now() + totalDuration - riseTime);

  rightOsc.frequency.setValueAtTime(startCarrier + 2, Tone.now());
  rightOsc.frequency.linearRampTo(secondCarrier + 2, transitionTime, Tone.now());
  rightOsc.frequency.setValueAtTime(secondCarrier + 2, Tone.now() + totalDuration - riseTime);
  rightOsc.frequency.linearRampTo(startCarrier + 2, riseTime, Tone.now() + totalDuration - riseTime);
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

// Visualize multiple beat frequencies
function visualizeBeatFrequencies(beatFrequencies) {
  let phase = 0;
  function draw() {
    requestAnimationFrame(draw);
    phase += 0.01;
    ctx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    ctx.beginPath();
    for (let x = 0; x < waveCanvas.width; x++) {
      let y = waveCanvas.height / 2;
      beatFrequencies.forEach(freq => {
        y += Math.sin(x * 0.01 * freq + phase) * 50 / beatFrequencies.length;
      });
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
      const carrier = getCurrentCarrier(time, parseInt(transitionTimeInput.value) * 60, parseInt(riseTimeInput.value) * 60, totalDuration, parseFloat(carrierFrequencyInput.value) || 200, parseFloat(secondCarrierInput.value) || 150);
      const y = waveCanvas.height / 2 + Math.sin(x * 0.01 * beatFrequency) * (carrier / 1000) * 50;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Current position indicator
    const progress = Math.min((elapsed / totalDuration) * waveCanvas.width, waveCanvas.width);
    ctx.beginPath();
    ctx.moveTo(progress, 0);
    ctx.lineTo(progress, waveCanvas.height);
    ctx.strokeStyle = '#ff0000';
    ctx.stroke();
  }
  draw();
}
