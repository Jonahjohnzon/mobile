import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
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

  // Season/episode picker, driven off matchDetail.resource.seasons.
  const [seasons, setSeasons] = useState([]); // [{se, maxEp, resolutions}]
  const [selectedSeason, setSelectedSeason] = useState(null); // the `se` value
  const [selectedEpisode, setSelectedEpisode] = useState(1);

  // Which resolution is currently downloading, and its progress 0-1.
  const [downloadingRes, setDownloadingRes] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

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
      Alert.alert('No download link', `No URL is available for ${source?.resolution ?? 'this quality'} yet.`);
      return;
    }

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo/media library access to save the video.');
      return;
    }

    const filename = `${match?.slug || match?.name || 'video'}-${source.resolution}.${(source.format || 'mp4').toLowerCase()}`;
    // Download to a private temp location first, then hand it to
    // MediaLibrary — content:// gallery URIs aren't valid download targets.
    const tempDest = FileSystem.cacheDirectory + filename;

    setDownloadingRes(source.resolution);
    setDownloadProgress(0);
    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        source.url,
        tempDest,
        {},
        (progress) => {
          const pct = progress.totalBytesExpectedToWrite
            ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite
            : 0;
          setDownloadProgress(pct);
        }
      );
      const result = await downloadResumable.downloadAsync();
      console.log('[DScreen] download complete:', result?.uri);

      const asset = await MediaLibrary.createAssetAsync(result.uri);
      // Group saved videos into their own album instead of dumping loose
      // files into the top-level camera roll.
      const albumName = 'Silo';
      const existingAlbum = await MediaLibrary.getAlbumAsync(albumName);
      if (existingAlbum) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false);
      } else {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      }

      // Clean up the temp copy now that it's safely in the gallery.
      await FileSystem.deleteAsync(result.uri, { idempotent: true });

      Alert.alert('Download complete', `Saved ${source.resolution} to your Photos/Gallery (${albumName} album).`);
    } catch (err) {
      console.error('[DScreen] Download failed:', err);
      Alert.alert('Download failed', err?.message || 'Something went wrong.');
    } finally {
      setDownloadingRes(null);
      setDownloadProgress(0);
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
                const isDownloading = downloadingRes === source.resolution;
                return (
                  <Pressable
                    key={source.resolution}
                    onPress={() => handleDownload(source)}
                    disabled={isDownloading}
                    className="flex-row items-center justify-between rounded-2xl px-4 py-3.5 mb-2"
                    style={{ backgroundColor: colors.surface, opacity: isDownloading ? 0.7 : 1 }}
                  >
                    <View>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.ink }}>
                        {source.resolution}
                      </Text>
                      <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: colors.inkMuted, marginTop: 2 }}>
                        {source.format} · {formatBytes(source.size)}
                      </Text>
                    </View>
                    {isDownloading ? (
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
    </View>
  );
}