import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator, ScrollView, Modal, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { api } from '../api/ApiCore';
import { colors } from '../constants/theme';

const { StorageAccessFramework } = FileSystem;

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!n || Number.isNaN(n)) return '';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(0)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const norm = (s) => (s || '').trim().toLowerCase();

// --- Android "save to Downloads" helpers -----------------------------------
// SAF requires the user to grant folder access once via a system picker
// (they can navigate to and select "Download"). We cache the granted
// directoryUri in module scope so subsequent downloads in this app session
// don't re-prompt. If you want it to survive app restarts, persist
// `cachedDirUri` with AsyncStorage/SecureStore instead.
let cachedDirUri = null;

async function getDownloadDirUri() {
  if (cachedDirUri) return cachedDirUri;
  const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return null;
  cachedDirUri = perm.directoryUri;
  return cachedDirUri;
}

// Copies a file already sitting in cache/document storage into the
// user-picked SAF directory (e.g. Download). Goes through base64, so very
// large video files will spend a moment buffering in memory — fine for
// typical mobile-quality downloads, but if you start seeing OOM on big
// files, swap this for a native streaming module instead.
async function saveToSAF(sourceUri, filename, mimeType, dirUri) {
  const destUri = await StorageAccessFramework.createFileAsync(dirUri, filename, mimeType);
  const base64 = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await FileSystem.writeAsStringAsync(destUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return destUri;
}

// Ensures we have MediaLibrary "add" permission before trying to save
// anything into the gallery/album. `writeOnly: true` requests the
// add-only permission (Android 10+ / iOS limited-add), which is all
// createAssetAsync needs — no full photo-library read access required.
// Returns true if granted, otherwise shows a message and returns false.
async function ensureMediaLibraryPermission(showMessage) {
  try {
    const { status: existingStatus } = await MediaLibrary.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync();
      finalStatus = status;

      if (status !== 'granted' && !canAskAgain) {
        showMessage(
          'Permission needed',
          'Saving videos requires access to your photos/media, and it looks like it was previously denied. Please enable it in your device Settings for this app.'
        );
        return false;
      }
    }

    if (finalStatus !== 'granted') {
      showMessage(
        'Permission needed',
        'Saving videos requires access to your photos/media. Please allow access to continue.'
      );
      return false;
    }

    return true;
  } catch (permErr) {
    console.error('[MEDIA PERMISSION] FAILED:', permErr);
    showMessage('Permission error', permErr?.message || 'Could not check media permissions.');
    return false;
  }
}
// -----------------------------------------------------------------------------

// RN port of the web app's /telestream?link=... route — the branch
// PosterCard/LibraryScreen take when `data.media_type === 'telenovela'`.
export default function DScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { id, type } = params ?? {};

  const [title, setTitle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null); // the chosen screenopps item
  const [matchDetail, setMatchDetail] = useState(null); // /detail/{slug} response for `match`

  const [streamInfo, setStreamInfo] = useState(null);
  const [streamLoading, setStreamLoading] = useState(false);

  // Subtitles for the current se/ep, from /api/stream/{subject_id}/captions.
  const [captions, setCaptions] = useState([]);
  const [captionsLoading, setCaptionsLoading] = useState(false);

  // Season/episode picker, driven off matchDetail.resource.seasons.
  const [seasons, setSeasons] = useState([]); // [{se, maxEp, resolutions}]
  const [selectedSeason, setSelectedSeason] = useState(null); // the `se` value
  const [selectedEpisode, setSelectedEpisode] = useState(1);

  // Which resolution is currently downloading, and its progress 0-1.
  // Which caption label is currently downloading, if any.
  // Non-null in either means a download is in flight — ALL video AND
  // caption buttons should disable while one is set, not just the tapped one.
  const [downloadingRes, setDownloadingRes] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadingCaption, setDownloadingCaption] = useState(null);
  const isAnyDownloading = downloadingRes !== null || downloadingCaption !== null;

  // In-app message modal — replaces native Alert for success/error/
  // permission messages so it stays consistent with the rest of the UI.
  const [messageModal, setMessageModal] = useState({ visible: false, title: '', message: '' });
  const showMessage = (title, message) => setMessageModal({ visible: true, title, message });
  const closeMessage = () => setMessageModal((m) => ({ ...m, visible: false }));

  const fetchStream = async (item, se, ep) => {
    setStreamLoading(true);
    try {
      const streamRes = await fetch(
        `https://api.screenopps.com/api/stream/${item.subject_id}?detail_path=${item.slug}&se=${se}&ep=${ep}`
      );
      const streamData = await streamRes.json();

      setStreamInfo(streamData);
    } catch (streamErr) {
      console.error('[DScreen] Failed to load stream info:', streamErr);
      setStreamInfo(null);
    } finally {
      setStreamLoading(false);
    }
  };

  const fetchCaptions = async (item, se, ep) => {
    setCaptionsLoading(true);
    try {
      const capRes = await fetch(
        `https://api.screenopps.com/api/stream/${item.subject_id}/captions?detail_path=${item.slug}&se=${se}&ep=${ep}`
      );
      const capData = await capRes.json();
      const list = Array.isArray(capData)
        ? capData
        : capData?.captions ?? capData?.subtitles ?? capData?.items ?? [];
      setCaptions(list);
    } catch (capErr) {
      console.error('[DScreen] Failed to load captions:', capErr);
      setCaptions([]);
    } finally {
      setCaptionsLoading(false);
    }
  };

  useEffect(() => {
    if (id == null || type == null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const tmdbDetail = await api.get(`/3/${type}/${id}?language=en-US`);
        if (cancelled) return;
        const resolvedTitle = tmdbDetail?.title || tmdbDetail?.name || null;
        setTitle(resolvedTitle);
        if (!resolvedTitle) return;

        // movie subjects use subjectType 1, tv/series use subjectType 2.
        const expectedSubjectType = type === 'tv' ? 2 : 1;
        const tmdbSeasonCount = tmdbDetail?.number_of_seasons;
        const soRes = await fetch(
          `https://api.screenopps.com/search?q=${encodeURIComponent(resolvedTitle)}`
        );
        const soData = await soRes.json();
        const items = soData?.items ?? [];

        const titleNorm = norm(resolvedTitle);

      function getTitleScore(candidateTitle) {
          const candidateNorm = norm(candidateTitle);

          if (candidateNorm === titleNorm) {
              return 100;
          }

          // TV titles may have suffixes such as S1-S6 or [English]
          if (type === 'tv' && candidateNorm.startsWith(titleNorm)) {
              return 80;
          }

          if (candidateNorm.includes(titleNorm)) {
              return 50;
          }

          if (titleNorm.includes(candidateNorm)) {
              return 40;
          }

          return 0;
      }

      const candidates = items
          .map(item => ({
              item,
              titleScore: getTitleScore(item.name)
          }))
          .filter(x => x.titleScore > 0)
          .sort((a, b) => b.titleScore - a.titleScore)
          .slice(0, 6);

      const detailResults = await Promise.allSettled(
          candidates.map(({ item }) =>
              fetch(
                  `https://api.screenopps.com/detail/${encodeURIComponent(item.slug)}`
              ).then(r => r.json())
          )
      );

      let best = null;
      let bestScore = -Infinity;

      detailResults.forEach((result, idx) => {
          if (result.status !== 'fulfilled') return;

          const detail = result.value?.data;
          const subj = detail?.subject;

          if (!subj) return;

          // Strongly prefer the correct media type
          if (subj.subjectType !== expectedSubjectType) return;

          const candidate = candidates[idx];

          let score = candidate.titleScore;

          // TV: compare number of seasons
          if (type === 'tv' && tmdbSeasonCount) {
              const seasons = detail?.resource?.seasons ?? [];

              if (seasons.length === tmdbSeasonCount) {
                  score += 50;
              } else {
                  score -= Math.abs(seasons.length - tmdbSeasonCount) * 10;
              }
          }

          if (score > bestScore) {
              bestScore = score;

              best = {
                  item: candidate.item,
                  detail
              };
          }
            });

        if (cancelled || !best) return;
        setMatch(best.item);
        setMatchDetail(best.detail);

        const seasonList = best.detail?.resource?.seasons ?? [];
        setSeasons(seasonList);
        // Movies are filed under se: 0; series start at se: 1. Read the real
        // value instead of assuming se=1.
        const seasonEntry = seasonList[0] ?? { se: expectedSubjectType === 1 ? 0 : 1 };
        // Movies also use ep: 0 (matching maxEp: 0), while series episodes
        // start at 1 — confirmed via se=0&ep=0 working for a movie subject.
        const initialEp = seasonEntry.se === 0 ? 0 : 1;
        setSelectedSeason(seasonEntry.se);
        setSelectedEpisode(initialEp);

        await fetchStream(best.item, seasonEntry.se, initialEp);
        fetchCaptions(best.item, seasonEntry.se, initialEp);
      } catch (err) {
        console.error('[DScreen] Failed to load title/stream:', err);
        if (!cancelled) setTitle(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, type]);

  // Current season entry, used only to display "Season X · Episode Y".
  const currentSeasonEntry = seasons.find((s) => s.se === selectedSeason) ?? null;
  const maxEp = currentSeasonEntry?.maxEp ?? 0;
  const isSeries = seasons.length > 0 && !!currentSeasonEntry && selectedSeason !== 0;

  const handleDownload = async (source) => {
    if (!source?.url) {
      showMessage('No download link', 'No URL is available.');
      return;
    }

    // Check/request MediaLibrary permission BEFORE downloading anything —
    // no point burning bandwidth on a file we won't be able to save.
    const hasPermission = await ensureMediaLibraryPermission(showMessage);
    if (!hasPermission) return;

    const safeName = (match?.slug || match?.name || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}-${source.resolution}.mp4`;
    const tempDest = FileSystem.cacheDirectory + filename;

    setDownloadingRes(source.resolution);
    setDownloadProgress(0);

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        source.url,
        tempDest,
        {
          headers: {
            Accept: 'video/mp4,video/*,*/*',
          },
        },
        (progress) => {
          if (progress.totalBytesExpectedToWrite > 0) {
            setDownloadProgress(progress.totalBytesWritten / progress.totalBytesExpectedToWrite);
          }
        }
      );

      const result = await downloadResumable.downloadAsync();

      const info = await FileSystem.getInfoAsync(result.uri);

      if (!info.exists || info.size < 100000) {
        throw new Error(`Downloaded file is invalid: ${info.size || 0} bytes`);
      }

      // Video goes through MediaLibrary on both platforms — it copies the
      // file natively (no JS string, no bridge), so it doesn't care how
      // large the file is. SAF/base64 was tried here for Android to land
      // videos literally in "Download", but reading a whole movie file into
      // a JS base64 string blows the heap and crashes with an
      // OutOfMemoryError on real devices. Captions stay on SAF below since
      // those files are only a few KB.
      const asset = await MediaLibrary.createAssetAsync(result.uri);

      const albumName = 'Gallery';
      const album = await MediaLibrary.getAlbumAsync(albumName);

      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      }

      await FileSystem.deleteAsync(result.uri, { idempotent: true });

      showMessage(
        'Download complete',
        `Saved Movie in ${albumName}.\n\nPath: ${asset.uri}`
      );
    } catch (err) {
      console.error('[DOWNLOAD] FAILED:', err);
      showMessage('Download failed', err?.message || 'Something went wrong.');
    } finally {
      setDownloadingRes(null);
      setDownloadProgress(0);
    }
  };

  // Subtitles aren't photos/videos, so MediaLibrary can't accept them.
  // Android: saved into the user-picked SAF directory (e.g. Download),
  // same as video. iOS: saved to the app's persistent document directory
  // (survives restarts, unlike cacheDirectory) — there's no public
  // Downloads-folder equivalent to target there.
  const handleDownloadCaption = async (caption, idx) => {
    const label =
      typeof caption === 'string'
        ? caption
        : caption?.lanName || caption?.lan || caption?.language || `subtitle-${idx + 1}`;
    const url = typeof caption === 'string' ? null : caption?.url;

    if (!url) {
      showMessage('No download link', `No URL is available for ${label}.`);
      return;
    }

    const safeLabel = String(label).replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = url.split('.').pop().split('?')[0].slice(0, 5) || 'vtt';
    const filename = `${(match?.slug || match?.name || 'video').replace(/[^a-zA-Z0-9_-]/g, '_')}-${safeLabel}.${ext}`;

    setDownloadingCaption(label);
    try {
      if (Platform.OS === 'android') {
        const tempDest = FileSystem.cacheDirectory + filename;
        const downloadResumable = FileSystem.createDownloadResumable(url, tempDest, {});
        const result = await downloadResumable.downloadAsync();

        const info = await FileSystem.getInfoAsync(result.uri);
        if (!info.exists) {
          throw new Error('Downloaded subtitle file is missing.');
        }

        const dirUri = await getDownloadDirUri();
        if (!dirUri) {
          throw new Error('Folder access was not granted, so the file could not be saved.');
        }

        const mimeType = ext === 'srt' ? 'application/x-subrip' : 'text/vtt';
        const savedUri = await saveToSAF(result.uri, filename, mimeType, dirUri);
        await FileSystem.deleteAsync(result.uri, { idempotent: true });

        showMessage('Download complete', `Saved ${label} subtitle.\n\nPath: ${savedUri}`);
      } else {
        const dest = FileSystem.documentDirectory + filename;
        const downloadResumable = FileSystem.createDownloadResumable(url, dest, {});
        const result = await downloadResumable.downloadAsync();

        const info = await FileSystem.getInfoAsync(result.uri);
        if (!info.exists) {
          throw new Error('Downloaded subtitle file is missing.');
        }

        showMessage('Download complete', `Saved ${label} subtitle.\n\nPath: ${result.uri}`);
      }
    } catch (err) {
      console.error('[CAPTION DOWNLOAD] FAILED:', err);
      showMessage('Download failed', err?.message || 'Something went wrong.');
    } finally {
      setDownloadingCaption(null);
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <Pressable
        onPress={() => navigation.goBack()}
        className="flex-row items-center px-4"
        style={{ paddingTop: 54, paddingBottom: 12 }}
      >
        <Feather name="chevron-left" size={20} color={colors.ink} />
        <Text className="ml-2" style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.ink }}>
          Back
        </Text>
      </Pressable>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.marquee} />
        </View>
      ) : match ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <View className="flex-row items-center rounded-2xl mb-4 p-2" style={{ backgroundColor: colors.surface }}>
            {match.poster_url ? (
              <Image
                source={{ uri: match.poster_url }}
                style={{ width: 64, height: 96, borderRadius: 6 }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ width: 64, height: 96, borderRadius: 6, backgroundColor: colors.bg }} />
            )}
            <Text
              className="ml-3 flex-1"
              style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 22, color: colors.ink }}
              numberOfLines={2}
            >
              {match.name}
            </Text>
          </View>

          {/* Current season/episode indicator — display only, not clickable */}
          {isSeries && (
            <View
              className="items-center rounded-2xl mb-4 px-2 py-2.5"
              style={{ backgroundColor: colors.surface }}
            >
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.ink }}>
                Season {selectedSeason}
                {maxEp > 1 ? ` · Episode ${selectedEpisode}` : ''}
              </Text>
            </View>
          )}

          {streamLoading ? (
            <View className="items-center py-10">
              <ActivityIndicator color={colors.marquee} />
            </View>
          ) : streamInfo?.sources?.length ? (
            <>
              {streamInfo.sources.map((source) => {
                const isThisDownloading = downloadingRes === source.resolution;
                // Disabled if THIS one is downloading, or any other one is —
                // only one download runs at a time across all buttons.
                const isDisabled = isAnyDownloading;
                return (
                  <Pressable
                    key={source.resolution}
                    onPress={() => handleDownload(source)}
                    disabled={isDisabled}
                    className="flex-row items-center justify-between rounded-2xl px-4 py-3.5 mb-2"
                    style={{
                      backgroundColor: colors.surface,
                      opacity: isDisabled ? (isThisDownloading ? 0.85 : 0.35) : 1,
                    }}
                  >
                    <View>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.ink }}>
                        {source.resolution}
                      </Text>
                      <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: colors.inkMuted, marginTop: 2 }}>
                        {source.format} · {formatBytes(source.size)}
                      </Text>
                    </View>
                    {isThisDownloading ? (
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.marquee }}>
                        {Math.round(downloadProgress * 100)}%
                      </Text>
                    ) : (
                      <Feather name="download" size={18} color={colors.ink} />
                    )}
                  </Pressable>
                );
              })}
            </>
          ) : (
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.inkMuted }}>
              No stream sources found for this title.
            </Text>
          )}

          {/* Available subtitles for this se/ep — rendered below the video
              quality list, same row styling so it reads as a second
              downloadable list rather than a decorative tag row. */}
          {captionsLoading ? (
            <View className="items-center py-4">
              <ActivityIndicator color={colors.marquee} />
            </View>
          ) : captions.length > 0 ? (
            <View className="mt-2">
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 12,
                  color: colors.inkMuted,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Subtitles
              </Text>
              {captions.map((c, idx) => {
                const label =
                  typeof c === 'string' ? c : c?.lanName || c?.lan || c?.language || `Subtitle ${idx + 1}`;
                const isThisDownloading = downloadingCaption === label;
                return (
                  <Pressable
                    key={label + idx}
                    onPress={() => handleDownloadCaption(c, idx)}
                    disabled={isAnyDownloading}
                    className="flex-row items-center justify-between rounded-2xl px-4 py-5 mb-2"
                    style={{
                      backgroundColor: colors.surface,
                      opacity: isAnyDownloading ? (isThisDownloading ? 0.85 : 0.35) : 1,
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.ink }}>
                      {label}
                    </Text>
                    {isThisDownloading ? (
                      <ActivityIndicator size="small" color={colors.marquee} />
                    ) : (
                      <Feather name="download" size={16} color={colors.ink} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <Text
            className="text-center"
            style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 24, color: colors.ink }}
          >
            {title || 'Empty'}
          </Text>
        </View>
      )}

      {/* In-app message modal — replaces native Alert */}
      <Modal visible={messageModal.visible} transparent animationType="fade" onRequestClose={closeMessage}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}
        >
          <View
            style={{
              width: '100%',
              borderRadius: 16,
              padding: 20,
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.surface,
            }}
          >
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.ink, marginBottom: 6 }}>
              {messageModal.title}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.inkMuted, lineHeight: 19 }}>
              {messageModal.message}
            </Text>
            <Pressable
              onPress={closeMessage}
              className="rounded-full items-center justify-center mt-5 py-3"
              style={{ backgroundColor: colors.marquee }}
            >
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.bg }}>
                OK
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}