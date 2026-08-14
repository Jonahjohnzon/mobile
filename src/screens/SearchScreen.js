import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/ApiCore';
import GridPosterCard, { GAP, H_PADDING } from '../components/Gridpostercard';
import { colors } from '../constants/theme';

let debounceHandle;

// People come back from /search/multi with profile_path, not poster_path,
// and no title/name field GridPosterCard expects consistently — normalize
// so the card can render a person exactly like a movie/tv result.
const normalizeResult = (item) => {
  if (item.media_type === 'person') {
    return {
      ...item,
      poster_path: item.profile_path,
      title: item.name,
    };
  }
  return item;
};

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const totalPagesRef = useRef(1);
  const queryRef = useRef('');

  const dedupeAndSet = (list, append) => {
    setResults((prev) => {
      const base = append ? prev : [];
      const seen = new Set(base.map((r) => `${r.media_type}-${r.id}`));
      const merged = [...base];
      for (const r of list) {
        const key = `${r.media_type}-${r.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(normalizeResult(r));
        }
      }
      return merged;
    });
  };

  const runSearch = useCallback(async (text) => {
    queryRef.current = text;
    if (!text.trim()) {
      setResults([]);
      pageRef.current = 1;
      totalPagesRef.current = 1;
      return;
    }
    setLoading(true);
    pageRef.current = 1;
    try {
      const res = await api.get('/3/search/multi', { query: text, language: 'en-US', page: 1 });
      totalPagesRef.current = res?.total_pages ?? 1;
      dedupeAndSet(
        (res?.results ?? []).filter((r) => r.poster_path || r.profile_path),
        false
      );
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore) return;
    if (!queryRef.current.trim()) return;
    if (pageRef.current >= totalPagesRef.current) return;

    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    try {
      const res = await api.get('/3/search/multi', {
        query: queryRef.current,
        language: 'en-US',
        page: nextPage,
      });
      pageRef.current = nextPage;
      dedupeAndSet(
        (res?.results ?? []).filter((r) => r.poster_path || r.profile_path),
        true
      );
    } catch (err) {
      console.error('Load more failed:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore]);

  const onChangeText = (text) => {
    setQuery(text);
    clearTimeout(debounceHandle);
    debounceHandle = setTimeout(() => runSearch(text), 400);
  };

  const onPressResult = (data) => {
    if (data.media_type === 'person') {
      navigation.push('Actor', { id: data.id, name: data.name });
    } else {
      navigation.navigate('Details', { id: data.id, type: data.media_type || 'movie' });
    }
  };

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-3 pb-4">
        <Text style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 32, color: colors.ink }}>
          Find a Screening
        </Text>
        <View className="flex-row items-center mt-4 bg-surface rounded-full px-4" style={{ height: 46 }}>
          <Feather name="search" size={16} color={colors.inkFaint} />
          <TextInput
            value={query}
            onChangeText={onChangeText}
            placeholder="Titles, people, genres…"
            placeholderTextColor={colors.inkFaint}
            className="flex-1 ml-3 text-ink"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </View>

      {loading && (
        <View className="items-center py-8">
          <ActivityIndicator color={colors.marquee} />
        </View>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <Text className="text-inkFaint text-center mt-10" style={{ fontFamily: 'Inter_400Regular' }}>
          Nothing showing under that title.
        </Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(item, i) => `${item.media_type || 'movie'}-${item.id}-${i}`}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ paddingHorizontal: H_PADDING, justifyContent: 'flex-start', gap: GAP }}
        contentContainerStyle={{ paddingBottom: 24, gap: GAP }}
        renderItem={({ item }) => <GridPosterCard data={item} onPress={onPressResult} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View className="items-center py-6">
              <ActivityIndicator color={colors.marquee} />
            </View>
          ) : null
        }
      />
    </View>
  );
}