import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { api } from '../api/ApiCore';
import { colors } from '../constants/theme';

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!n || Number.isNaN(n)) return '';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(0)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const norm = (s) => (s || '').trim().toLowerCase();

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
      console.log('[DScreen] stream info result:', streamData);
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
      console.log('[DScreen] captions result:', capData);
      // Shape isn't confirmed yet — handle the likely possibilities: a bare
      // array, or wrapped under `captions`/`subtitles`/`items`.
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
        // TV entries are frequently suffixed ("S1-S6", "[English]"), so a
        // startsWith check catches them; movies are usually the bare title.
        let candidates =
          type === 'tv'
            ? items.filter((it) => norm(it.name).startsWith(titleNorm))
            : items.filter((it) => norm(it.name) === titleNorm);
        if (!candidates.length) {
          candidates = items.filter((it) => norm(it.name).includes(titleNorm));
        }
        if (!candidates.length) candidates = items;

        // Cap how many we probe with a detail call, to avoid a request storm
        // on a very generic title.
        const capped = candidates.slice(0, 6);

        const detailResults = await Promise.allSettled(
          capped.map((c) =>
            fetch(`https://api.screenopps.com/detail/${c.slug}`).then((r) => r.json())
          )
        );

        let best = null;
        let bestScore = -Infinity;
        detailResults.forEach((res, idx) => {
          if (res.status !== 'fulfilled') return;
          const subj = res.value?.data?.subject;
          if (!subj || subj.subjectType !== expectedSubjectType) return;
          const candidateSeasons = res.value?.data?.resource?.seasons ?? [];
          const score =
            type === 'tv' && tmdbSeasonCount
              ? -Math.abs(candidateSeasons.length - tmdbSeasonCount)
              : 0;
          if (score > bestScore) {
            bestScore = score;
            best = { item: capped[idx], detail: res.value.data };
          }
        });

        // Nothing matched subjectType — fall back to the first candidate we
        // could actually fetch detail for, so we still show *something*.
        if (!best) {
          const firstOk = detailResults.find((r) => r.status === 'fulfilled' && r.value?.data);
          if (firstOk) {
            const idx = detailResults.indexOf(firstOk);
            best = { item: capped[idx], detail: firstOk.value.data };
          }
        }

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

    const { status } = await MediaLibrary.requestPermissionsAsync();

    if (status !== 'granted') {
      showMessage('Permission needed', 'Allow media library access to save the video.');
      return;
    }

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

      const asset = await MediaLibrary.createAssetAsync(result.uri);

      const albumName = 'Silo';
      const album = await MediaLibrary.getAlbumAsync(albumName);

      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      }

      await FileSystem.deleteAsync(result.uri, { idempotent: true });

      showMessage(
        'Download complete',
        `Saved ${source.resolution} to ${albumName}.\n\nPath: ${asset.uri}`
      );
    } catch (err) {
      console.error('[DOWNLOAD] FAILED:', err);
      showMessage('Download failed', err?.message || 'Something went wrong.');
    } finally {
      setDownloadingRes(null);
      setDownloadProgress(0);
    }
  };

  // Subtitles aren't photos/videos, so MediaLibrary can't accept them —
  // they're saved to the app's persistent document directory instead
  // (survives restarts, unlike cacheDirectory) and the exact path is
  // shown in the completion message so the user knows where to find it.
  const handleDownloadCaption = async (caption, idx) => {
    const label =
      typeof caption === 'string'
        ? caption
        : caption?.label || caption?.lang || caption?.language || `subtitle-${idx + 1}`;
    const url = typeof caption === 'string' ? null : caption?.url;

    if (!url) {
      showMessage('No download link', `No URL is available for ${label}.`);
      return;
    }

    const safeLabel = String(label).replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = url.split('.').pop().split('?')[0].slice(0, 5) || 'vtt';
    const filename = `${(match?.slug || match?.name || 'video').replace(/[^a-zA-Z0-9_-]/g, '_')}-${safeLabel}.${ext}`;
    const dest = FileSystem.documentDirectory + filename;

    setDownloadingCaption(label);
    try {
      const downloadResumable = FileSystem.createDownloadResumable(url, dest, {});
      const result = await downloadResumable.downloadAsync();

      const info = await FileSystem.getInfoAsync(result.uri);
      if (!info.exists) {
        throw new Error('Downloaded subtitle file is missing.');
      }

      showMessage('Download complete', `Saved ${label} subtitle.\n\nPath: ${result.uri}`);
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
                  typeof c === 'string' ? c : c?.label || c?.lang || c?.language || `Subtitle ${idx + 1}`;
                const isThisDownloading = downloadingCaption === label;
                return (
                  <Pressable
                    key={label + idx}
                    onPress={() => handleDownloadCaption(c, idx)}
                    disabled={isAnyDownloading}
                    className="flex-row items-center justify-between rounded-2xl px-4 py-3 mb-2"
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