import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { getUserHistory } from '../lib/screenOppsApi';
import GridPosterCard, { GAP, H_PADDING } from '../components/Gridpostercard';
import { colors } from '../constants/theme';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const loadingMoreRef = useRef(false);

  const fetchFirstPage = useCallback(async ({ showSpinner } = {}) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const data = await getUserHistory(1);
      setItems(data?.data || []);
      setTotalPages(data?.totalPages || 1);
      setPage(1);
    } catch (err) {
      console.error('Failed to load history:', err);
      setError("Couldn't load your history — try again.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getUserHistory(1);

        if (cancelled) return;
        setItems(data?.data || []);
        setTotalPages(data?.totalPages || 1);
        setPage(1);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load history:', err);
        setError("Couldn't load your history — try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFirstPage({ showSpinner: false });
    setRefreshing(false);
  }, [fetchFirstPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMoreRef.current || page >= totalPages) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const data = await getUserHistory(nextPage);

      const seen = new Set(items.map((i) => i.id));
      const fresh = (data?.data || []).filter((i) => !seen.has(i.id));
      setItems((prev) => [...prev, ...fresh]);
      setPage(nextPage);
    } catch (err) {
      console.error('Failed to load more history:', err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [loading, page, totalPages, items]);

  const handleScroll = useCallback(({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    if (distanceFromBottom < 400) loadMore();
  }, [loadMore]);

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-3 pb-4 flex-row items-center">
        <Pressable
          onPress={() => navigation.goBack()}
          className="rounded-full items-center justify-center mr-3"
          style={{ width: 36, height: 36, backgroundColor: colors.surface }}
        >
          <Feather name="chevron-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 32, color: colors.ink }}>
          My History
        </Text>
      </View>

      {loading && (
        <View className="items-center py-16">
          <ActivityIndicator color={colors.marquee} />
        </View>
      )}

      {!loading && error && items.length === 0 && (
        <Text style={{ color: '#f87171', textAlign: 'center', marginTop: 40, paddingHorizontal: 24, fontFamily: 'Inter_400Regular' }}>
          {error}
        </Text>
      )}

      {!loading && items.length === 0 && !error && (
        <View className="flex-1 items-center justify-center px-10">
          <Feather name="clock" size={28} color={colors.inkFaint} />
          <Text className="text-inkFaint text-center mt-3" style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}>
            Nothing watched yet — your history will show up here.
          </Text>
        </View>
      )}

      {!loading && items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(item, i) => `${item.id}-${i}`}
          numColumns={3}
          columnWrapperStyle={{ paddingHorizontal: H_PADDING, justifyContent: 'flex-start', gap: GAP }}
          contentContainerStyle={{ paddingBottom: 24, gap: GAP }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.marquee}
              colors={[colors.marquee]}
            />
          }
          renderItem={({ item }) => (
            <GridPosterCard
              data={item}
              onPress={(data) =>
                navigation.navigate('Details', { id: data.id, type: data.media_type || data.type || 'movie' })
              }
            />
          )}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <ActivityIndicator color={colors.marquee} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}