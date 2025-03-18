// DOM Elements
const modeRadios = document.querySelectorAll('input[name="mode"]');
const sleepOptions = document.getElementById('sleep-options');
const toneOptions = document.getElementById('tone-options');
const stateSelect = document.getElementById('state');
const customFrequencyDiv = document.getElementById('custom-frequency');
const volumeSlider = document.getElementById('volume');
const playButton = document.getElementById('play');
const stopButton = document.getElementById('stop');

let leftOsc, rightOsc, masterGain;

// Toggle mode options
modeRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    sleepOptions.style.display = radio.value === 'sleep' ? 'block' : 'none';
    toneOptions.style.display = radio.value === 'tone' ? 'block' : 'none';
  });
});

// Show/hide custom frequency input
stateSelect.addEventListener('change', () => {
  customFrequencyDiv.style.display = stateSelect.value === 'custom' ? 'block' : 'none';
});

// Play audio
playButton.addEventListener('click', async () => {
  await Tone.start(); // Resume audio context on user interaction
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const volume = volumeSlider.value / 100;

  // Stop any existing oscillators
  if (leftOsc) {
    leftOsc.stop();
    rightOsc.stop();
  }

  // Create master gain node
  masterGain = new Tone.Gain(volume).toDestination();

  if (mode === 'sleep') {
    const totalTime = parseInt(document.getElementById('total-time').value) * 60; // Seconds
    const carrier = 200;
    const alphaBeat = 10; // Alpha: 10 Hz
    const deltaBeat = 2;  // Delta: 2 Hz

    leftOsc = new Tone.Oscillator(carrier, 'sine');
    rightOsc = new Tone.Oscillator(carrier + alphaBeat, 'sine');
    
    // Panning for binaural effect
    const leftPanner = new Tone.Panner(-1).connect(masterGain);
    const rightPanner = new Tone.Panner(1).connect(masterGain);
    leftOsc.connect(leftPanner);
    rightOsc.connect(rightPanner);

    leftOsc.start();
    rightOsc.start();

    // Sleep cycle transitions
    const transitionTime = 1800; // 30 minutes in seconds
    if (totalTime >= 2 * transitionTime) {
      // Alpha to Delta over 30 min
      rightOsc.frequency.linearRampTo(carrier + deltaBeat, transitionTime, Tone.now());
      // Hold Delta, then Delta to Alpha over last 30 min
      rightOsc.frequency.setValueAtTime(carrier + deltaBeat, Tone.now() + totalTime - transitionTime);
      rightOsc.frequency.linearRampTo(carrier + alphaBeat, transitionTime, Tone.now() + totalTime - transitionTime);
    } else {
      // For shorter durations, split time evenly
      const halfTime = totalTime / 2;
      rightOsc.frequency.linearRampTo(carrier + deltaBeat, halfTime, Tone.now());
      rightOsc.frequency.setValueAtTime(carrier + deltaBeat, Tone.now() + halfTime);
      rightOsc.frequency.linearRampTo(carrier + alphaBeat, halfTime, Tone.now() + halfTime);
    }
  } else {
    // Tone generator mode
    const state = stateSelect.value;
    let carrier = 200;
    let beatFrequency;

    if (state === '432') {
      carrier = 432; // Healing frequency carrier
      beatFrequency = 2; // Delta beat
    } else if (state === 'custom') {
      beatFrequency = parseFloat(document.getElementById('custom-hz').value);
    } else {
      beatFrequency = parseFloat(state);
    }

    leftOsc = new Tone.Oscillator(carrier, 'sine');
    rightOsc = new Tone.Oscillator(carrier + beatFrequency, 'sine');

    // Panning for binaural effect
    const leftPanner = new Tone.Panner(-1).connect(masterGain);
    const rightPanner = new Tone.Panner(1).connect(masterGain);
    leftOsc.connect(leftPanner);
    rightOsc.connect(rightPanner);

    leftOsc.start();
    rightOsc.start();
  }
});

// Stop audio
stopButton.addEventListener('click', () => {
  if (leftOsc) {
    masterGain.gain.rampTo(0, 2); // Fade out over 2 seconds
    setTimeout(() => {
      leftOsc.stop();
      rightOsc.stop();
      leftOsc = null;
      rightOsc = null;
    }, 2000);
  }
});

// Real-time volume adjustment
volumeSlider.addEventListener('input', () => {
  const volume = volumeSlider.value / 100;
  if (masterGain) {
    masterGain.gain.value = volume;
  }
});
