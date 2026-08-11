import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { api } from '../api/ApiCore';
import SectionHeader from './SectionHeader';
import { colors } from '../constants/theme';

const { width } = Dimensions.get('window');
const PLAYER_HEIGHT = ((width - 32) * 9) / 16;

// Same "pick a random movie once we know the list length" fix as the web
// version — never assumes at least 20 items are present.
const TrailerSpotlight = ({ trailers = [] }) => {
  const [id, setId] = useState(null);
  const [videoKey, setVideoKey] = useState(null);
  const [trailerName, setTrailerName] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (trailers.length) {
      setId(trailers[Math.floor(Math.random() * trailers.length)]?.id);
    }
  }, [trailers]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setVideoKey(null);
      try {
        const res = await api.get(`/3/movie/${id}/videos?language=en-US`);
        if (cancelled) return;
        const trailer = res?.results?.find((v) => v.type === 'Trailer');
        setVideoKey(trailer?.key ?? null);
        setTrailerName(trailer?.name ?? 'Trailer');
      } catch (err) {
        if (!cancelled) console.error('Failed to load trailer:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!trailers.length) return null;

  return (
    <View className="mb-8">
      <SectionHeader title="Today's Screening" eyebrow="TRAILER" />
      <View className="mx-4 rounded-2xl overflow-hidden bg-surface" style={{ height: PLAYER_HEIGHT }}>
        {loading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.marquee} />
          </View>
        )}
        {!loading && videoKey && (
          <WebView
            source={{ uri: `https://www.youtube.com/embed/${videoKey}?rel=0&controls=1` }}
            style={{ flex: 1, backgroundColor: colors.surface }}
            allowsFullscreenVideo
          />
        )}
        {!loading && !videoKey && (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-inkFaint text-center" style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}>
              No trailer available right now.
            </Text>
          </View>
        )}
      </View>
      {!loading && trailerName && videoKey && (
        <Text
          className="text-inkMuted px-4 mt-2"
          style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 11 }}
        >
          {trailerName}
        </Text>
      )}
    </View>
  );
};

export default TrailerSpotlight;
