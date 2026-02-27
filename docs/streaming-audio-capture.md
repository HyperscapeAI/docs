# Streaming Audio Capture Guide

Hyperscape captures game audio (music and sound effects) for RTMP streams using PulseAudio virtual sinks. This guide covers the setup, configuration, and troubleshooting.

## Architecture

```
Chrome Browser → PulseAudio (chrome_audio sink) → FFmpeg (monitor capture) → RTMP
```

**Flow:**
1. Chrome outputs audio to PulseAudio virtual sink (`chrome_audio`)
2. FFmpeg captures from the sink's monitor (`chrome_audio.monitor`)
3. FFmpeg encodes to AAC and muxes with video
4. Combined stream sent to RTMP destinations

## PulseAudio Setup

### User-Mode Configuration

The deployment uses user-mode PulseAudio (more reliable than system mode):

```bash
# Setup XDG runtime directory
export XDG_RUNTIME_DIR=/tmp/pulse-runtime
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

# Create PulseAudio config directory
mkdir -p /root/.config/pulse

# Create default.pa config
cat > /root/.config/pulse/default.pa << 'EOF'
.fail
load-module module-null-sink sink_name=chrome_audio sink_properties=device.description="ChromeAudio"
set-default-sink chrome_audio
load-module module-native-protocol-unix auth-anonymous=1
EOF

# Start PulseAudio
pulseaudio --start --exit-idle-time=-1 --daemonize=yes

# Export PULSE_SERVER for child processes
export PULSE_SERVER="unix:$XDG_RUNTIME_DIR/pulse/native"
```

### Virtual Sink

The `chrome_audio` sink is a null sink (virtual audio device) that:
- Accepts audio from Chrome browser
- Provides a monitor source for FFmpeg to capture
- Doesn't output to physical speakers (headless server)

**Create sink manually:**
```bash
pactl load-module module-null-sink sink_name=chrome_audio sink_properties=device.description="ChromeAudio"
pactl set-default-sink chrome_audio
```

### Verification

**Check PulseAudio status:**
```bash
pulseaudio --check && echo "Running" || echo "Not running"
```

**List sinks:**
```bash
pactl list short sinks
# Expected output:
# 0   chrome_audio   module-null-sink.c   s16le 2ch 44100Hz   IDLE
```

**List sources (monitors):**
```bash
pactl list short sources
# Expected output:
# 0   chrome_audio.monitor   module-null-sink.c   s16le 2ch 44100Hz   IDLE
```

**Check default sink:**
```bash
pactl info | grep "Default Sink"
# Expected: Default Sink: chrome_audio
```

## FFmpeg Audio Capture

### Capture Configuration

FFmpeg captures from the PulseAudio monitor with buffering and stability features:

```bash
-thread_queue_size 1024 \
-use_wallclock_as_timestamps 1 \
-f pulse \
-ac 2 \
-ar 44100 \
-i chrome_audio.monitor
```

**Parameters:**
- `thread_queue_size 1024` - Buffer 1024 audio packets to prevent underruns
- `use_wallclock_as_timestamps 1` - Use wall clock for accurate timing
- `f pulse` - PulseAudio input format
- `ac 2` - 2 audio channels (stereo)
- `ar 44100` - 44.1kHz sample rate
- `i chrome_audio.monitor` - Capture from monitor source

### Audio Filter

Async resampling recovers from audio drift:

```bash
-af aresample=async=1000:first_pts=0
```

**Parameters:**
- `async=1000` - Resample if drift exceeds 1000 samples (22ms at 44.1kHz)
- `first_pts=0` - Start PTS at 0 for consistent timing

This prevents audio dropouts when video/audio streams desync.

### Audio Encoding

```bash
-c:a aac \
-b:a 128k \
-ar 44100 \
-flags +global_header
```

**Parameters:**
- `c:a aac` - AAC audio codec (required for RTMP)
- `b:a 128k` - 128 kbps bitrate (configurable via STREAM_AUDIO_BITRATE_KBPS)
- `ar 44100` - 44.1kHz output sample rate
- `flags +global_header` - Required for RTMP muxing

### Fallback to Silent Audio

If PulseAudio is not accessible, FFmpeg uses a silent audio source:

```bash
-f lavfi -i anullsrc=r=44100:cl=stereo
```

This ensures RTMP servers that require an audio track still work.

## Chrome Browser Configuration

### Audio Output

Chrome must be configured to output to PulseAudio:

```bash
# Set PULSE_SERVER environment variable before launching Chrome
export PULSE_SERVER="unix:/tmp/pulse-runtime/pulse/native"

# Chrome will automatically use the default PulseAudio sink (chrome_audio)
```

**Verification in Chrome:**
```javascript
// In browser console
navigator.mediaDevices.enumerateDevices().then(devices => {
  console.log(devices.filter(d => d.kind === 'audiooutput'));
});
// Should show PulseAudio devices
```

## Troubleshooting

### PulseAudio Not Running

**Symptoms:**
- FFmpeg errors: `pulse: Connection refused`
- No audio in stream
- pactl commands fail

**Fix:**
```bash
# Kill any existing PulseAudio
pulseaudio --kill
pkill -9 pulseaudio
sleep 2

# Restart with config
pulseaudio --start --exit-idle-time=-1 --daemonize=yes

# Verify
pulseaudio --check && echo "OK" || echo "FAILED"
```

### chrome_audio Sink Missing

**Symptoms:**
- pactl list short sinks doesn't show chrome_audio
- FFmpeg errors: `pulse: No such device`

**Fix:**
```bash
# Create sink manually
pactl load-module module-null-sink sink_name=chrome_audio sink_properties=device.description="ChromeAudio"
pactl set-default-sink chrome_audio

# Verify
pactl list short sinks | grep chrome_audio
```

### No Audio in Stream

**Check PulseAudio:**
```bash
# Verify sink exists
pactl list short sinks | grep chrome_audio

# Verify monitor source exists
pactl list short sources | grep chrome_audio.monitor

# Check if audio is flowing
pactl list sinks | grep -A 10 chrome_audio | grep "Volume"
```

**Check FFmpeg:**
```bash
# Look for PulseAudio input in FFmpeg logs
pm2 logs hyperscape-duel | grep -i pulse

# Should see:
# [pulse @ ...] Stream parameters: 2 channels, s16le, 44100 Hz
```

**Check Chrome:**
```bash
# Verify PULSE_SERVER is set in ecosystem.config.cjs
grep PULSE_SERVER ecosystem.config.cjs

# Should be: unix:/tmp/pulse-runtime/pulse/native
```

### Audio Dropouts or Stuttering

**Symptoms:**
- Intermittent audio gaps
- Audio desync from video
- FFmpeg warnings about buffer underruns

**Fix 1: Increase thread_queue_size**
```bash
# In rtmp-bridge.ts or FFmpeg args
-thread_queue_size 2048  # Increase from 1024
```

**Fix 2: Check async resampling**
```bash
# Verify audio filter is applied
pm2 logs hyperscape-duel | grep aresample

# Should see: aresample=async=1000:first_pts=0
```

**Fix 3: Remove -shortest flag**
```bash
# This flag was removed in recent commits
# It caused audio dropouts during video buffering
# Verify it's not in your FFmpeg args
```

### Audio/Video Desync

**Symptoms:**
- Audio plays ahead or behind video
- Gradual drift over time

**Fix:**
```bash
# Ensure wall clock timestamps are enabled
-use_wallclock_as_timestamps 1

# Ensure async resampling is enabled
-af aresample=async=1000:first_pts=0

# Check for -shortest flag (should NOT be present)
pm2 logs hyperscape-duel | grep -- "-shortest"
```

### Permission Errors

**Symptoms:**
- FFmpeg errors: `pulse: Access denied`
- pactl commands fail with permission errors

**Fix:**
```bash
# Ensure XDG_RUNTIME_DIR has correct permissions
chmod 700 /tmp/pulse-runtime

# Ensure PulseAudio is running as the same user as FFmpeg
ps aux | grep pulseaudio
ps aux | grep ffmpeg
# Both should be running as root (or same user)

# Check PULSE_SERVER environment variable
echo $PULSE_SERVER
# Should be: unix:/tmp/pulse-runtime/pulse/native
```

## Environment Variables

### Required

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_AUDIO_ENABLED` | `true` | Enable audio capture |
| `PULSE_AUDIO_DEVICE` | `chrome_audio.monitor` | PulseAudio monitor device |
| `PULSE_SERVER` | `unix:/tmp/pulse-runtime/pulse/native` | PulseAudio server socket |
| `XDG_RUNTIME_DIR` | `/tmp/pulse-runtime` | Runtime directory for PulseAudio |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_AUDIO_BITRATE_KBPS` | `128` | Audio bitrate in kbps |
| `STREAM_LOW_LATENCY` | `false` | Use zerolatency tune (disables async resampling) |

## Testing Audio Capture

### Test PulseAudio Capture

```bash
# Record 5 seconds of audio from monitor
parecord --device=chrome_audio.monitor --file-format=wav test-audio.wav &
RECORD_PID=$!
sleep 5
kill $RECORD_PID

# Play back (requires speakers or audio output)
paplay test-audio.wav

# Check file size (should be > 0 if audio is flowing)
ls -lh test-audio.wav
```

### Test FFmpeg Capture

```bash
# Capture 10 seconds to file
ffmpeg -f pulse -i chrome_audio.monitor -t 10 -c:a aac test-capture.aac

# Check file size
ls -lh test-capture.aac
# Should be ~160KB for 10s at 128kbps
```

### Test Full Pipeline

```bash
# Start streaming with diagnostics
pm2 logs hyperscape-duel | grep -iE "audio|pulse|aac"

# Look for:
# - "Audio capture from PulseAudio: chrome_audio.monitor"
# - "[pulse @ ...] Stream parameters: 2 channels, s16le, 44100 Hz"
# - "Stream #0:1: Audio: aac, 44100 Hz, stereo, 128 kb/s"
```

## Performance Considerations

### CPU Usage

Audio encoding adds ~5-10% CPU overhead:
- AAC encoding: ~5% CPU (single core)
- PulseAudio: ~2-3% CPU
- Async resampling: ~1-2% CPU

**Optimization:**
- Use hardware audio encoding if available (rare on Linux)
- Reduce audio bitrate: `STREAM_AUDIO_BITRATE_KBPS=96`
- Disable audio: `STREAM_AUDIO_ENABLED=false`

### Memory Usage

PulseAudio uses ~20-30MB RAM:
- Virtual sink buffer: ~10MB
- Module overhead: ~10MB
- Monitor source: ~5MB

### Latency

Audio latency breakdown:
- PulseAudio buffer: ~20-50ms
- FFmpeg capture buffer: ~50-100ms (thread_queue_size=1024)
- Async resampling: ~20-40ms
- **Total**: ~100-200ms

For lower latency:
- Reduce thread_queue_size: `512` (may cause underruns)
- Enable low latency mode: `STREAM_LOW_LATENCY=true` (disables async resampling)

## Advanced Configuration

### Custom PulseAudio Config

Edit `/root/.config/pulse/default.pa`:

```bash
.fail

# Load virtual sink with custom properties
load-module module-null-sink \
  sink_name=chrome_audio \
  sink_properties=device.description="ChromeAudio" \
  rate=48000 \
  channels=2

# Set as default
set-default-sink chrome_audio

# Enable network protocol (for remote monitoring)
load-module module-native-protocol-unix auth-anonymous=1

# Optional: Load additional modules
# load-module module-echo-cancel
# load-module module-equalizer-sink
```

**Restart PulseAudio:**
```bash
pulseaudio --kill
pulseaudio --start --exit-idle-time=-1 --daemonize=yes
```

### Multiple Audio Sources

To capture from multiple sources (e.g., game + microphone):

```bash
# Create second sink for microphone
pactl load-module module-null-sink sink_name=mic_audio

# Combine sinks
pactl load-module module-combine-sink \
  sink_name=combined \
  slaves=chrome_audio,mic_audio

# Capture from combined monitor
-f pulse -i combined.monitor
```

### Audio Filters

FFmpeg supports various audio filters:

```bash
# Volume normalization
-af "loudnorm=I=-16:TP=-1.5:LRA=11"

# Noise reduction
-af "afftdn=nf=-25"

# Compression
-af "acompressor=threshold=-20dB:ratio=4:attack=5:release=50"

# Chain multiple filters
-af "aresample=async=1000:first_pts=0,loudnorm=I=-16:TP=-1.5:LRA=11"
```

## Integration with Streaming

### FFmpeg Command (CDP Direct Mode)

Full FFmpeg command with audio capture:

```bash
ffmpeg \
  # Video input (JPEG frames)
  -fflags +genpts+discardcorrupt \
  -thread_queue_size 1024 \
  -f mjpeg \
  -framerate 30 \
  -i pipe:0 \
  # Audio input (PulseAudio)
  -thread_queue_size 1024 \
  -use_wallclock_as_timestamps 1 \
  -f pulse \
  -ac 2 \
  -ar 44100 \
  -i chrome_audio.monitor \
  # Map streams
  -map 0:v:0 \
  -map 1:a:0 \
  # Video encoding
  -r 30 \
  -vf "scale=1280:720:flags=lanczos,format=yuv420p" \
  -c:v libx264 \
  -preset ultrafast \
  -tune film \
  -b:v 4500k \
  -maxrate 5400k \
  -bufsize 18000k \
  -pix_fmt yuv420p \
  -g 60 \
  -bf 2 \
  # Audio encoding
  -af aresample=async=1000:first_pts=0 \
  -c:a aac \
  -b:a 128k \
  -ar 44100 \
  -flags +global_header \
  # Output
  -f tee "[f=flv:onfail=ignore:flvflags=no_duration_filesize]rtmp://..."
```

### Ecosystem Config

Environment variables in `ecosystem.config.cjs`:

```javascript
env: {
  // Audio capture
  STREAM_AUDIO_ENABLED: "true",
  PULSE_AUDIO_DEVICE: "chrome_audio.monitor",
  PULSE_SERVER: "unix:/tmp/pulse-runtime/pulse/native",
  XDG_RUNTIME_DIR: "/tmp/pulse-runtime",
  
  // Audio encoding
  STREAM_AUDIO_BITRATE_KBPS: "128",
  
  // ... other config
}
```

## Troubleshooting

### No Audio in Stream

**1. Check PulseAudio is running:**
```bash
pulseaudio --check && echo "OK" || echo "FAILED"
```

**2. Check chrome_audio sink exists:**
```bash
pactl list short sinks | grep chrome_audio
```

**3. Check FFmpeg is capturing:**
```bash
pm2 logs hyperscape-duel | grep -i pulse
# Should see: [pulse @ ...] Stream parameters: 2 channels, s16le, 44100 Hz
```

**4. Check audio is flowing:**
```bash
# Monitor audio levels
pactl list sinks | grep -A 10 chrome_audio | grep "Volume"

# Or use pavucontrol (if GUI available)
pavucontrol
```

**5. Check PULSE_SERVER environment:**
```bash
echo $PULSE_SERVER
# Should be: unix:/tmp/pulse-runtime/pulse/native

# Verify in PM2
pm2 show hyperscape-duel | grep PULSE_SERVER
```

### Audio Dropouts

**Symptoms:**
- Intermittent audio gaps
- Audio cuts out during video buffering

**Causes:**
- `-shortest` flag (removed in recent commits)
- Insufficient thread_queue_size
- Audio drift without async resampling

**Fix:**
```bash
# Ensure -shortest flag is NOT present
pm2 logs hyperscape-duel | grep -- "-shortest"
# Should return nothing

# Increase thread_queue_size
-thread_queue_size 2048  # Increase from 1024

# Verify async resampling
pm2 logs hyperscape-duel | grep aresample
# Should see: aresample=async=1000:first_pts=0
```

### Audio/Video Desync

**Symptoms:**
- Audio plays ahead or behind video
- Gradual drift over time

**Fix:**
```bash
# Ensure wall clock timestamps are enabled
pm2 logs hyperscape-duel | grep use_wallclock_as_timestamps
# Should see: -use_wallclock_as_timestamps 1

# Ensure async resampling is enabled
pm2 logs hyperscape-duel | grep aresample
# Should see: aresample=async=1000:first_pts=0

# Check for -shortest flag (should NOT be present)
pm2 logs hyperscape-duel | grep -- "-shortest"
```

### PulseAudio Permission Errors

**Symptoms:**
- FFmpeg errors: `pulse: Access denied`
- pactl commands fail

**Fix:**
```bash
# Ensure XDG_RUNTIME_DIR has correct permissions
chmod 700 /tmp/pulse-runtime

# Ensure PulseAudio socket exists
ls -la /tmp/pulse-runtime/pulse/native

# Restart PulseAudio
pulseaudio --kill
pulseaudio --start --exit-idle-time=-1 --daemonize=yes
```

### Buffer Underruns

**Symptoms:**
- FFmpeg warnings: `Thread message queue blocking`
- Audio stuttering
- Dropped frames

**Fix:**
```bash
# Increase thread_queue_size for audio
-thread_queue_size 2048  # Increase from 1024

# Increase thread_queue_size for video too
-thread_queue_size 2048  # For video input

# Check system load
top
# If CPU > 90%, reduce encoding quality or resolution
```

### Audio Encoding Errors

**Symptoms:**
- FFmpeg errors: `aac: Encoding error`
- Stream fails to start

**Fix:**
```bash
# Check audio codec support
ffmpeg -codecs | grep aac
# Should show: DEA.L. aac

# Try alternative AAC encoder
-c:a libfdk_aac  # If available (better quality)

# Reduce bitrate
-b:a 96k  # Reduce from 128k

# Check sample rate
-ar 44100  # Must match PulseAudio output
```

## Performance Optimization

### Reduce CPU Usage

```bash
# Lower audio bitrate
export STREAM_AUDIO_BITRATE_KBPS=96  # Reduce from 128

# Disable audio entirely
export STREAM_AUDIO_ENABLED=false

# Use hardware encoding (if available)
-c:a aac_at  # macOS only
```

### Reduce Latency

```bash
# Enable low latency mode
export STREAM_LOW_LATENCY=true

# Reduce thread_queue_size
-thread_queue_size 512  # Reduce from 1024 (may cause underruns)

# Disable async resampling (may cause drift)
-af ""  # Remove aresample filter
```

### Improve Quality

```bash
# Increase audio bitrate
export STREAM_AUDIO_BITRATE_KBPS=192  # Increase from 128

# Use higher sample rate
-ar 48000  # Increase from 44100

# Add audio filters
-af "aresample=async=1000:first_pts=0,loudnorm=I=-16:TP=-1.5:LRA=11"
```

## Monitoring

### Real-time Audio Levels

```bash
# Monitor PulseAudio levels
watch -n 1 'pactl list sinks | grep -A 10 chrome_audio | grep Volume'

# Monitor FFmpeg audio stats
pm2 logs hyperscape-duel | grep -E "Audio:|aac"
```

### Audio Statistics

```bash
# Check FFmpeg audio stream info
pm2 logs hyperscape-duel | grep "Stream #0:1"
# Should show: Audio: aac, 44100 Hz, stereo, 128 kb/s

# Check for audio errors
pm2 logs hyperscape-duel --err | grep -i audio
```

## Related Documentation

- [Vast.ai Deployment](vast-deployment.md)
- [Streaming Improvements (Feb 2026)](streaming-improvements-feb-2026.md)
- [RTMP Bridge Source](../packages/server/src/streaming/rtmp-bridge.ts)
- [Deploy Script](../scripts/deploy-vast.sh)
- [Ecosystem Config](../ecosystem.config.cjs)
