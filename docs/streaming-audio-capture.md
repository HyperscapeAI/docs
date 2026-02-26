# Streaming Audio Capture with PulseAudio

This document describes how Hyperscape captures game audio (music and sound effects) for RTMP streaming using PulseAudio virtual sinks.

## Overview

As of February 2026, Hyperscape supports audio capture from the game client for inclusion in RTMP streams. This enables viewers to hear game music, sound effects, and ambient audio alongside the video feed.

## Architecture

### Components

1. **PulseAudio** - Linux audio server running in user mode
2. **Virtual Sink** - `chrome_audio` null sink for audio routing
3. **Chrome Browser** - Configured to output to PulseAudio sink
4. **FFmpeg** - Captures from PulseAudio monitor device

### Audio Flow

```
Game Client (Chrome) 
  → PulseAudio (chrome_audio sink)
    → Monitor device (chrome_audio.monitor)
      → FFmpeg capture
        → RTMP stream
```

## Setup (Vast.ai Deployment)

The deployment script (`scripts/deploy-vast.sh`) automatically configures PulseAudio:

### 1. Install PulseAudio

```bash
apt-get install -y pulseaudio pulseaudio-utils
```

### 2. Configure User Mode

PulseAudio runs in user mode (more reliable than system mode):

```bash
export XDG_RUNTIME_DIR=/tmp/pulse-runtime
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"
```

### 3. Create Virtual Sink

Create `/root/.config/pulse/default.pa`:

```
.fail
load-module module-null-sink sink_name=chrome_audio sink_properties=device.description="ChromeAudio"
set-default-sink chrome_audio
load-module module-native-protocol-unix auth-anonymous=1
```

### 4. Start PulseAudio

```bash
pulseaudio --start --exit-idle-time=-1 --daemonize=yes
```

### 5. Verify Setup

```bash
# Check PulseAudio is running
pulseaudio --check

# List sinks
pactl list short sinks

# Should show:
# 0  chrome_audio  module-null-sink.c  s16le 2ch 44100Hz  RUNNING
```

## Configuration

### Environment Variables

```bash
# packages/server/.env

# Enable audio capture (default: true)
STREAM_AUDIO_ENABLED=true

# PulseAudio device to capture from
PULSE_AUDIO_DEVICE=chrome_audio.monitor

# PulseAudio server socket
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native

# XDG runtime directory
XDG_RUNTIME_DIR=/tmp/pulse-runtime
```

### FFmpeg Integration

FFmpeg captures audio with these settings:

```bash
# Audio input
-f pulse -i chrome_audio.monitor

# Audio encoding
-c:a aac -b:a 128k -ar 44100 -ac 2

# Buffering and sync
-thread_queue_size 1024
-use_wallclock_as_timestamps 1
-aresample async=1000:first_pts=0
```

### Buffering and Sync

**Thread Queue Size**: 1024 frames prevents buffer underruns

**Wall Clock Timestamps**: Maintains real-time timing for PulseAudio

**Async Resampling**: Recovers from audio drift when it exceeds 22ms

## Troubleshooting

### No Audio in Stream

**Check PulseAudio is running**:
```bash
pulseaudio --check
echo $?  # Should be 0
```

**Check sink exists**:
```bash
pactl list short sinks | grep chrome_audio
```

**Check FFmpeg is capturing**:
```bash
# View FFmpeg logs
tail -f logs/duel-out.log | grep -i audio
```

**Manually test capture**:
```bash
# Record 10 seconds of audio
ffmpeg -f pulse -i chrome_audio.monitor -t 10 test.wav

# Play back
ffplay test.wav
```

### Audio Drift or Stuttering

**Symptoms**: Audio gradually desynchronizes from video or stutters

**Causes**:
- Buffer underruns (thread_queue_size too small)
- Clock drift (wall clock timestamps not used)
- Resampling not enabled

**Fix**:
```bash
# Increase buffer size
STREAM_AUDIO_BUFFER_SIZE=2048

# Verify async resampling is enabled
# Check FFmpeg command includes: -aresample async=1000:first_pts=0
```

### PulseAudio Won't Start

**Check permissions**:
```bash
# XDG_RUNTIME_DIR must be writable
ls -la /tmp/pulse-runtime
# Should show: drwx------ (700)
```

**Check for conflicts**:
```bash
# Kill existing PulseAudio
pulseaudio --kill
pkill -9 pulseaudio

# Remove stale sockets
rm -rf /tmp/pulse-runtime/pulse

# Restart
pulseaudio --start --exit-idle-time=-1 --daemonize=yes
```

**Fallback to silent audio**:

If PulseAudio fails, FFmpeg falls back to silent audio (anullsrc):

```bash
# Silent audio fallback
-f lavfi -i anullsrc=r=44100:cl=stereo
```

### Chrome Not Using PulseAudio

**Check Chrome audio output**:
```bash
# Chrome should be configured with:
--autoplay-policy=no-user-gesture-required
--use-fake-ui-for-media-stream

# PulseAudio should be default sink
pactl info | grep "Default Sink"
# Should show: chrome_audio
```

**Force Chrome to use PulseAudio**:
```bash
# Set default sink before starting Chrome
pactl set-default-sink chrome_audio

# Verify
pactl info | grep "Default Sink"
```

## Performance Considerations

### CPU Usage

Audio capture adds minimal CPU overhead:
- PulseAudio: ~1-2% CPU
- FFmpeg audio encoding (AAC): ~3-5% CPU
- Total: ~5-7% CPU increase

### Memory Usage

- PulseAudio: ~20-30MB RAM
- Audio buffers: ~10-20MB RAM
- Total: ~30-50MB RAM increase

### Latency

- PulseAudio latency: ~20-50ms
- FFmpeg buffering: ~100-200ms
- Total audio latency: ~120-250ms

This is acceptable for streaming (video latency is typically 2-5 seconds).

## Advanced Configuration

### Custom Audio Filters

Add audio filters to FFmpeg command:

```bash
# Normalize audio levels
-af "loudnorm=I=-16:TP=-1.5:LRA=11"

# Reduce background noise
-af "highpass=f=200,lowpass=f=3000"

# Compress dynamic range
-af "acompressor=threshold=-20dB:ratio=4:attack=5:release=50"
```

### Multiple Audio Sources

Capture multiple audio sources and mix:

```bash
# Game audio + microphone
-f pulse -i chrome_audio.monitor \
-f pulse -i alsa_input.usb-microphone \
-filter_complex "[0:a][1:a]amix=inputs=2:duration=longest"
```

### Audio-Only Streaming

Stream audio without video:

```bash
# Audio-only RTMP
ffmpeg -f pulse -i chrome_audio.monitor \
  -c:a aac -b:a 128k \
  -f flv rtmp://live.twitch.tv/app/your-stream-key
```

## Related Documentation

- [docs/streaming-configuration.md](streaming-configuration.md) - RTMP streaming setup
- [docs/vast-deployment.md](vast-deployment.md) - Vast.ai deployment guide
- [packages/server/.env.example](../packages/server/.env.example) - Configuration reference
- [scripts/deploy-vast.sh](../scripts/deploy-vast.sh) - Deployment script with PulseAudio setup

## References

- [PulseAudio Documentation](https://www.freedesktop.org/wiki/Software/PulseAudio/)
- [FFmpeg PulseAudio Input](https://ffmpeg.org/ffmpeg-devices.html#pulse)
- [FFmpeg Audio Filters](https://ffmpeg.org/ffmpeg-filters.html#Audio-Filters)
