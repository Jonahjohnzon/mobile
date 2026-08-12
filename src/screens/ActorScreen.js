import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Image, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/ApiCore';
import ReadMoreText from '../components/ReadMoreText';
import GridPosterCard, { GAP, H_PADDING } from '../components/Gridpostercard';
import { colors } from '../constants/theme';

const PAGE_SIZE = 20;

export default function ActorScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { id, name } = params ?? {};
  const [person, setPerson] = useState(null);
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [personRes, creditsRes] = await Promise.allSettled([
          api.get(`/3/person/${id}?language=en-US`),
          api.get(`/3/person/${id}/combined_credits?language=en-US`),
        ]);
        if (cancelled) return;
        if (personRes.status === 'fulfilled') setPerson(personRes.value);
        if (creditsRes.status === 'fulfilled') {
          const seen = new Set();
          const known = (creditsRes.value?.cast ?? [])
            .filter((c) => c.poster_path)
            .filter((c) => {
              // TMDB can list the same title twice (e.g. multiple episodes/roles);
              // dedupe by id + media_type since credit_id is unique per role, not per title
              const dedupeKey = `${c.media_type || 'movie'}-${c.id}`;
              if (seen.has(dedupeKey)) return false;
              seen.add(dedupeKey);
              return true;
            })
            .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
          setCredits(known);
        }
      } catch (err) {
        console.error('Failed to load actor:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // reset pagination whenever we load a new person
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [id]);

  const handleScroll = useCallback(
    ({ nativeEvent }) => {
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      const distanceFromBottom =
        contentSize.height - (layoutMeasurement.height + contentOffset.y);

      if (distanceFromBottom < 300 && !loadingMoreRef.current) {
        setVisibleCount((prev) => {
          if (prev >= credits.length) return prev;
          loadingMoreRef.current = true;
          // release the lock on next tick so we don't fire repeatedly per scroll frame
          setTimeout(() => {
            loadingMoreRef.current = false;
          }, 0);
          return Math.min(prev + PAGE_SIZE, credits.length);
        });
      }
    },
    [credits.length]
  );

  const imageBase = process.env.EXPO_PUBLIC_SIZEIMAGE;
  const FALLBACK_IMG = require('../../assets/poster-fallback.png');
  const visibleCredits = credits.slice(0, visibleCount);
  const hasMore = visibleCount < credits.length;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-bg">
      {/* Fixed back button — sits above the ScrollView, does not scroll */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingTop: 4,
          paddingHorizontal: 16,
          paddingBottom: 12,
        }}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => navigation.goBack()}
          className="rounded-full items-center justify-center"
          style={{ width: 36, height: 36, backgroundColor: colors.surface }}
        >
          <Feather name="chevron-left" size={20} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 4 + 36 + 12 }}
      >
        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={colors.marquee} />
          </View>
        ) : (
          <>
            <View className="items-center px-6">
              <View
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  overflow: 'hidden',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.marqueeDim,
                }}
              >
                <Image
                  source={person?.profile_path ? { uri: `${imageBase}${person.profile_path}` } : FALLBACK_IMG}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </View>
              <Text
                style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 30, color: colors.ink, marginTop: 12 }}
              >
                {person?.name ?? name}
              </Text>
              {!!person?.known_for_department && (
                <Text
                  style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: colors.marquee, marginTop: 2 }}
                >
                  {person.known_for_department.toUpperCase()}
                </Text>
              )}
            </View>

            {!!person?.biography && (
              <View className="px-4 mt-6">
                <ReadMoreText
                  style={{ fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, color: colors.inkMuted }}
                >
                  {person.biography}
                </ReadMoreText>
              </View>
            )}

            {credits.length > 0 && (
              <View className="mt-8" style={{ paddingHorizontal: H_PADDING }}>
                <Text
                  style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: colors.marquee, marginBottom: 4 }}
                >
                  CREDITS
                </Text>
                <Text
                  style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 22, color: colors.ink, marginBottom: 14 }}
                >
                  Known For
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
                  {visibleCredits.map((item, index) => (
                    <GridPosterCard
                      key={`${item.media_type || 'movie'}-${item.id}-${item.credit_id || index}`}
                      data={item}
                      onPress={(data) =>
                        navigation.push('Details', { id: data.id, type: data.media_type || 'movie' })
                      }
                    />
                  ))}
                </View>
                {hasMore && (
                  <View className="items-center py-6">
                    <ActivityIndicator color={colors.marquee} />
                  </View>
                )}
              </View>
            )}

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}