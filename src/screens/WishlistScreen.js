import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { getUserWishlist, deleteWish } from '../lib/screenOppsApi';
import GridPosterCard, { COLUMN_WIDTH, GAP, H_PADDING } from '../components/Gridpostercard';
import { colors } from '../constants/theme';

const WishlistCard = ({ item, onPress, onRemove, removing }) => (
  <View style={{ width: COLUMN_WIDTH }}>
    <GridPosterCard data={item} onPress={onPress} />
    <Pressable
      onPress={() => onRemove(item.id)}
      disabled={removing}
      hitSlop={8}
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(0,0,0,0.65)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {removing ? (
        <ActivityIndicator size="small" color={colors.ink} />
      ) : (
        <Feather name="trash-2" size={13} color="#f87171" />
      )}
    </Pressable>
  </View>
);

export default function WishlistScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getUserWishlist(1);
        if (cancelled) return;
        setItems(data?.data || []);
        setTotalPages(data?.totalPages || 1);
        setPage(1);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load wishlist:', err);
        setError("Couldn't load your wishlist — try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || loadingMoreRef.current || page >= totalPages) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const data = await getUserWishlist(nextPage);
      const seen = new Set(items.map((i) => i.id));
      const fresh = (data?.data || []).filter((i) => !seen.has(i.id));
      setItems((prev) => [...prev, ...fresh]);
      setPage(nextPage);
    } catch (err) {
      console.error('Failed to load more wishlist:', err);
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

  const handleRemove = async (id) => {
    setRemovingId(id);
    try {
      const result = await deleteWish(id);
      if (result?.success !== false) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error('Failed to remove from wishlist:', err);
    } finally {
      setRemovingId(null);
    }
  };

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
             My Wishlist
           </Text>
         </View>

      {loading && (
        <View className="items-center py-16">
          <ActivityIndicator color={colors.marquee} />
        </View>
      )}

      {!loading && error && (
        <Text style={{ color: '#f87171', textAlign: 'center', marginTop: 40, paddingHorizontal: 24, fontFamily: 'Inter_400Regular' }}>
          {error}
        </Text>
      )}

      {!loading && !error && items.length === 0 && (
        <View className="flex-1 items-center justify-center px-10">
          <Feather name="star" size={28} color={colors.inkFaint} />
          <Text className="text-inkFaint text-center mt-3" style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}>
            Nothing in your wishlist yet — add something you want to watch.
          </Text>
        </View>
      )}

      {!loading && !error && items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(item, i) => `${item.id}-${i}`}
          numColumns={3}
          columnWrapperStyle={{ paddingHorizontal: H_PADDING, justifyContent: 'flex-start', gap: GAP }}
          contentContainerStyle={{ paddingBottom: 24, gap: GAP }}
          onScroll={handleScroll}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <WishlistCard
              item={item}
              removing={removingId === item.id}
              onRemove={handleRemove}
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