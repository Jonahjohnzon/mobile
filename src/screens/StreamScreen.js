import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Animated, Modal } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Feather } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getVideo, fetchServerVideo } from '../lib/screenOppsApi';
import { ListServer } from '../constants/servers';
import { colors } from '../constants/theme';
import {pushHistory} from '../lib/screenOppsApi';
import { api } from '../api/ApiCore';

const DOUBLE_TAP_MS = 300;
const SEEK_SECONDS = 10;
const CONTROLS_HIDE_MS = 3000;

const STREAM_REFERER = process.env.EXPO_PUBLIC_STREAM_REFERER || '';

function buildSourceHeaders() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  };
  if (STREAM_REFERER) headers.Referer = STREAM_REFERER;
  return headers;
}

function formatTime(ms) {
  if (!ms || Number.isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const SeekFlash = ({ side, visible, amount }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(1);
    Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }).start();
  }, [visible, amount, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.seekFlash, side === 'left' ? { left: 0 } : { right: 0 }, { opacity }]}
    >
      <Feather name={side === 'left' ? 'rotate-ccw' : 'rotate-cw'} size={26} color={colors.ink} />
      <Text style={styles.seekFlashText}>{SEEK_SECONDS}s</Text>
    </Animated.View>
  );
};

// Plain .map instead of FlatList — this list is always exactly
// ListServer.length items (3), so there's no virtualization benefit,
// and .map guarantees every row re-renders whenever currentServerId
// changes (FlatList row recycling was the reason the checkmark could
// get stuck on the old server despite state updating correctly).
const ServerSheet = ({ visible, currentServerId, switching, onSelect, onClose }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable onPress={onClose} style={styles.sheetBackdrop}>
      <Pressable onPress={() => {}} style={styles.sheetBody}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Server</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.sheetCloseButton}>
            <Feather name="x" size={18} color={colors.inkFaint} />
          </Pressable>
        </View>

        {ListServer.map((item) => {
          const active = item.id === currentServerId;
          return (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item)}
              disabled={switching}
              style={[styles.sheetRow, active && styles.sheetRowActive]}
            >
              <Text style={[styles.sheetRowText, active && styles.sheetRowTextActive]}>{item.name}</Text>
              {active && <Feather name="check" size={16} color={colors.marquee} />}
            </Pressable>
          );
        })}

        {switching && (
          <View style={styles.sheetSwitchingRow}>
            <ActivityIndicator size="small" color={colors.marquee} />
            <Text style={styles.sheetSwitchingText}>Switching…</Text>
          </View>
        )}
      </Pressable>
    </Pressable>
  </Modal>
);

export default function StreamScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { id, type, season, episode, title } = params ?? {};
  const videoRef = useRef(null);
  const [status, setStatus] = useState({});
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isSeekingBar, setIsSeekingBar] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [flashSide, setFlashSide] = useState(null);
  const [flashKey, setFlashKey] = useState(0);

  const [resolving, setResolving] = useState(true);
  const [resolvingServerName, setResolvingServerName] = useState(null);
  const [playerUri, setPlayerUri] = useState(null);
  const [videoTitle, setVideoTitle] = useState(title);
  const [currentServerId, setCurrentServerId] = useState(null);

  const [serverSheetOpen, setServerSheetOpen] = useState(false);
  const [switchingServer, setSwitchingServer] = useState(false);

  const [downloadState, setDownloadState] = useState('idle'); // idle | downloading | done
  const [downloadProgress, setDownloadProgress] = useState(0);

  const lastTapRef = useRef({ left: 0, right: 0 });
  const hideTimerRef = useRef(null);

  const isPlaying = status.isPlaying ?? false;
  const isBuffering = status.isBuffering ?? false;
  const duration = status.durationMillis ?? 0;
  const position = isSeekingBar ? scrubPosition : status.positionMillis ?? 0;

    const GET = async () => {
    let Detail;
    if (type === "movie") {
      Detail = await api.get(`/3/movie/${id}?language=en-US`);
    } else {
      Detail = await api.get(`/3/tv/${id}?language=en-US`);
    }

    const historyBody = {
      id: Detail?.id,
      media_type: type,
      poster_path: Detail?.poster_path,
      name: Detail?.name,
      original_name: Detail?.original_name,
      title: Detail?.title,
      vote_average: Detail?.vote_average,
      season: season,
      episode: episode,
    };

    await pushHistory(historyBody);
  };

  // Initial load: try servers in order until one works.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setResolving(true);
      setError(null);
      try {
        const res = await getVideo({ id, type, season, episode }, (server) => {
          if (!cancelled) setResolvingServerName(server.name);
        });
        if (cancelled) return;
        await GET(); // Push to history after successfully resolving a video
        if (res?.url) {
          setPlayerUri(res.url);
          setCurrentServerId(res.server);
          if (res.title) setVideoTitle(res.title);
        } else {
          navigation.replace('BStream', { id, type, season: String(season), episode: String(episode) })
          setError("Couldn't find a working source — try again later.");
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to resolve video:', err);
        setError("Couldn't load this video — try again.");
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, type, season, episode]);

  // ---- Controls auto-hide timer ----
  // Only re-armed on explicit user interaction, never on playback status
  // ticks, or it never gets a clean window to fire.
  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, CONTROLS_HIDE_MS);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => clearHideTimer, []);

  useEffect(() => () => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  // Whenever an error appears (playback failure or no source), force
  // controls hidden — only the error overlay (with its own buttons)
  // should show, not the play/seek/download row on top of it.
  useEffect(() => {
    if (error) {
      clearHideTimer();
      setControlsVisible(false);
    }
  }, [error]);

  // Manual server switch: fetches exactly the tapped server, no fallback
  // loop. Sheet stays open so the checkmark visibly updates.
  const handleSelectServer = async (server) => {
    if (server.id === currentServerId || switchingServer) return;
    setSwitchingServer(true);
    setError(null);
    try {
      const res = await fetchServerVideo({ id, type, season, episode, server: server.id, includeMeta: false });
      const workingSource = res?.sources?.find((s) => !!s.url);
      if (workingSource) {
        setPlayerUri(workingSource.url);
        setCurrentServerId(server.id);
        showControls();
      } else {
        setError(`${server.name} has no source available right now — pick another server.`);
      }
    } catch (err) {
      console.error(`Server ${server.id} failed:`, err);
      setError(`Couldn't load ${server.name} — pick another server.`);
    } finally {
      setSwitchingServer(false);
    }
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
    showControls();
  };

  const seekBy = async (deltaMs) => {
    if (!videoRef.current || !duration) return;
    const next = Math.max(0, Math.min(duration, (status.positionMillis ?? 0) + deltaMs));
    await videoRef.current.setPositionAsync(next);
  };

  const handleSingleTap = () => {
    if (error) return; // nothing to toggle — error overlay owns the screen
    setControlsVisible((prev) => {
      const next = !prev;
      if (next) scheduleHide();
      return next;
    });
  };

  const handleZoneTap = (side) => {
    if (error) return;
    const now = Date.now();
    const last = lastTapRef.current[side];
    if (now - last < DOUBLE_TAP_MS) {
      lastTapRef.current[side] = 0;
      seekBy(side === 'left' ? -SEEK_SECONDS * 1000 : SEEK_SECONDS * 1000);
      setFlashSide(side);
      setFlashKey((k) => k + 1);
      clearHideTimer();
    } else {
      lastTapRef.current[side] = now;
      setTimeout(() => {
        if (lastTapRef.current[side] !== 0) {
          lastTapRef.current[side] = 0;
          handleSingleTap();
        }
      }, DOUBLE_TAP_MS);
    }
  };

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setIsFullscreen(false);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      setIsFullscreen(true);
    }
  };

  const handleDownload = async () => {
    if (!playerUri || downloadState === 'downloading') return;

    const { status: permStatus } = await MediaLibrary.requestPermissionsAsync();
    if (permStatus !== 'granted') {
      setError('Storage permission is needed to download.');
      return;
    }

    const cleanPath = playerUri.split('?')[0];
    const ext = cleanPath.includes('.') ? cleanPath.split('.').pop().slice(0, 4) : 'mp4';
    const fileName = `${(videoTitle || 'video').replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.${ext}`;
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    setDownloadState('downloading');
    setDownloadProgress(0);

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        playerUri,
        fileUri,
        { headers: buildSourceHeaders() },
        (progress) => {
          const pct = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
          setDownloadProgress(Number.isFinite(pct) ? pct : 0);
        }
      );
      const result = await downloadResumable.downloadAsync();
      if (!result?.uri) throw new Error('Download did not complete');

      await MediaLibrary.saveToLibraryAsync(result.uri);
      setDownloadState('done');
      setTimeout(() => setDownloadState('idle'), 2500);
    } catch (err) {
      console.error('Download failed:', err);
      setDownloadState('idle');
      setError('Download failed — try again.');
    }
  };

  if (resolving) {
    return (
      <View style={[styles.container, styles.emptyState]}>
        <ActivityIndicator size="large" color={colors.marquee} />
        {!!resolvingServerName && <Text style={styles.emptyText}>Checking {resolvingServerName}…</Text>}
      </View>
    );
  }

  const currentServerName = ListServer.find((s) => s.id === currentServerId)?.name ?? currentServerId;
  const showPlayerControls = playerUri && controlsVisible && !error;

  return (
    <View style={styles.container}>
      {playerUri ? (
        <Video
          ref={videoRef}
          source={{ uri: playerUri, headers: buildSourceHeaders() }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          onPlaybackStatusUpdate={(s) => {
            setStatus(s);
            if (s.didJustFinish) showControls();
          }}
          onError={(e) => {
            const msg = typeof e === 'string' ? e : 'Playback failed.';
            const looksForbidden = /403|forbidden/i.test(msg);
            setError(
              looksForbidden
                ? `${currentServerName} refused this request (403) — try another server.`
                : `${msg} Try another server if this keeps happening.`
            );
          }}
          progressUpdateIntervalMillis={250}
        />
      ) : (
        <View style={styles.emptyState}>
          <Feather name="film" size={26} color={colors.inkFaint} />
          <Text style={styles.emptyText}>
            {error || `No source available for ${type} #${id}${type === 'tv' ? ` S${season}E${episode}` : ''}.`}
          </Text>
        </View>
      )}

      {playerUri && (
        <>
          {!error && (
            <View style={styles.tapZoneRow} pointerEvents="box-none">
              <Pressable style={styles.tapZone} onPress={() => handleZoneTap('left')} />
              <View style={styles.tapZoneCenter} pointerEvents="none" />
              <Pressable style={styles.tapZone} onPress={() => handleZoneTap('right')} />
            </View>
          )}

          <SeekFlash side="left" visible={flashSide === 'left'} amount={flashKey} />
          <SeekFlash side="right" visible={flashSide === 'right'} amount={flashKey} />

          {isBuffering && !error && (
            <View style={styles.bufferOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={colors.marquee} />
            </View>
          )}

          {error && (
            <View style={styles.errorOverlay}>
              <Feather name="alert-triangle" size={26} color={colors.ticket} />
              <Text style={styles.errorText}>{error}</Text>
              <View style={styles.errorButtonRow}>
                <Pressable
                  style={[styles.retryButton, { backgroundColor: colors.surface, marginRight: 10 }]}
                  onPress={() => setServerSheetOpen(true)}
                >
                  <Text style={[styles.retryText, { color: colors.ink }]}>Change Server</Text>
                </Pressable>
                <Pressable
                  style={styles.retryButton}
                  onPress={() => {
                    setError(null);
                    navigation.replace('BStream', { id, type, season: String(season), episode: String(episode) })
                  }}
                >
                  <Text style={styles.retryText}>Try Backup Server</Text>
                </Pressable>
              </View>
            </View>
          )}

          {showPlayerControls && (
            <View style={styles.controlsOverlay} pointerEvents="box-none">
              <View style={styles.topBar}>
                <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} hitSlop={10}>
                  <Feather name="chevron-left" size={22} color={colors.ink} />
                </Pressable>
                {!!videoTitle && (
                  <Text numberOfLines={1} style={styles.topTitle}>
                    {videoTitle}
                  </Text>
                )}
                <Pressable onPress={() => setServerSheetOpen(true)} style={styles.iconButton} hitSlop={10}>
                  <Feather name="server" size={17} color={colors.ink} />
                </Pressable>
                <Pressable
                  onPress={handleDownload}
                  disabled={downloadState === 'downloading'}
                  style={styles.iconButton}
                  hitSlop={10}
                >
                  {downloadState === 'downloading' ? (
                    <ActivityIndicator size="small" color={colors.ink} />
                  ) : (
                    <Feather
                      name={downloadState === 'done' ? 'check' : 'download'}
                      size={18}
                      color={downloadState === 'done' ? colors.marquee : colors.ink}
                    />
                  )}
                </Pressable>
                <Pressable onPress={toggleFullscreen} style={styles.iconButton} hitSlop={10}>
                  <Feather name={isFullscreen ? 'minimize' : 'maximize'} size={20} color={colors.ink} />
                </Pressable>
              </View>

              {downloadState === 'downloading' && (
                <View style={styles.downloadProgressWrap} pointerEvents="none">
                  <View style={styles.downloadProgressTrack}>
                    <View style={[styles.downloadProgressFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
                  </View>
                  <Text style={styles.downloadProgressText}>{Math.round(downloadProgress * 100)}%</Text>
                </View>
              )}

              <View style={styles.centerRow} pointerEvents="box-none">
                <Pressable onPress={() => seekBy(-SEEK_SECONDS * 1000)} style={styles.sideButton} hitSlop={12}>
                  <Feather name="rotate-ccw" size={26} color={colors.ink} />
                </Pressable>
                <Pressable onPress={togglePlay} style={styles.playButton} hitSlop={12}>
                  <Feather name={isPlaying ? 'pause' : 'play'} size={30} color={colors.bg} />
                </Pressable>
                <Pressable onPress={() => seekBy(SEEK_SECONDS * 1000)} style={styles.sideButton} hitSlop={12}>
                  <Feather name="rotate-cw" size={26} color={colors.ink} />
                </Pressable>
              </View>

              <View style={styles.bottomBar}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={duration || 1}
                  value={position}
                  minimumTrackTintColor={colors.marquee}
                  maximumTrackTintColor="rgba(255,255,255,0.25)"
                  thumbTintColor={colors.marquee}
                  onSlidingStart={() => {
                    clearHideTimer();
                    setIsSeekingBar(true);
                    setScrubPosition(status.positionMillis ?? 0);
                  }}
                  onValueChange={(v) => setScrubPosition(v)}
                  onSlidingComplete={async (v) => {
                    await videoRef.current?.setPositionAsync(v);
                    setIsSeekingBar(false);
                    scheduleHide();
                  }}
                />
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
            </View>
          )}
        </>
      )}

      <ServerSheet
        visible={serverSheetOpen}
        currentServerId={currentServerId}
        switching={switchingServer}
        onSelect={handleSelectServer}
        onClose={() => setServerSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.inkFaint,
    textAlign: 'center',
    marginTop: 12,
  },
  tapZoneRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  tapZone: { flex: 2 },
  tapZoneCenter: { flex: 1 },
  seekFlash: {
    position: 'absolute',
    top: '42%',
    width: 90,
    marginHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 45,
    paddingVertical: 14,
  },
  seekFlashText: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: colors.ink, marginTop: 4 },
  bufferOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 32,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.ink,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  errorButtonRow: { flexDirection: 'row' },
  retryButton: { backgroundColor: colors.marquee, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  retryText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.bg },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'space-between',
  },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 44, paddingHorizontal: 12, gap: 10 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.ink },
  downloadProgressWrap: { paddingHorizontal: 14, marginTop: 6 },
  downloadProgressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  downloadProgressFill: { height: '100%', backgroundColor: colors.marquee },
  downloadProgressText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    color: colors.inkMuted,
    marginTop: 4,
    textAlign: 'right',
  },
  centerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36 },
  sideButton: { padding: 8 },
  playButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.marquee,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 28, gap: 8 },
  slider: { flex: 1, height: 32 },
  timeText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 11,
    color: colors.inkMuted,
    minWidth: 40,
    textAlign: 'center',
  },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheetBody: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: colors.marqueeDim,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.marqueeDim,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 20, color: colors.ink },
  sheetCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRow: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetRowActive: { backgroundColor: colors.surface },
  sheetRowText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.ink },
  sheetRowTextActive: { fontFamily: 'Inter_600SemiBold', color: colors.marquee },
  sheetSwitchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 10,
  },
  sheetSwitchingText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.inkFaint },
});