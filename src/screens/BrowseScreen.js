import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, Modal, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { api, ApiError } from '../api/ApiCore';
import GridPosterCard, { GAP, H_PADDING } from '../components/Gridpostercard';
import { colors } from '../constants/theme';
import { movieGenre, tvGenre, countries, sortOptions, ratingOptions } from '../constants/genres';

const TMDB_MAX_PAGE = 500;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1940 + 1 }, (_, i) => CURRENT_YEAR - i);

// Same fix as the web Category.jsx buildDiscoverQuery: build params as an
// object instead of string-concatenating, so a falsy branch never
// stringifies `false` into the querystring.
function buildDiscoverParams({ type, genre, country, year, sortId, page, rating }) {
  const sortDef = sortOptions.find((s) => s.id === sortId) ?? sortOptions[0];
  const dateField = type === 'movie' ? 'primary_release_date' : 'first_air_date';
  const isAnime = genre === '16' && type === 'tv';

  const params = {
    include_adult: 'false',
    include_video: 'false',
    language: 'en-US',
    page: String(page),
    sort_by: sortDef.field(type),
    [`${dateField}.gte`]: `${year}-01-01`,
    [`${dateField}.lte`]: `${year}-12-31`,
    with_origin_country: isAnime ? 'JP' : country,
  };
  if (genre) params.with_genres = String(genre);
  if (sortDef.minVoteCount) params['vote_count.gte'] = String(sortDef.minVoteCount);
  if (rating) params['vote_average.gte'] = rating;

  return params;
}

const FilterPill = ({ label, disabled, onPress }) => (
  <Pressable
    onPress={disabled ? undefined : onPress}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      height: 36,
      borderRadius: 18,
      backgroundColor: disabled ? colors.surface + '80' : colors.surface,
      borderWidth: 1,
      borderColor: colors.marqueeDim,
      opacity: disabled ? 0.5 : 1,
    }}
  >
    <Text
      numberOfLines={1}
      style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.ink, maxWidth: 110 }}
    >
      {label}
    </Text>
    {!disabled && <Feather name="chevron-down" size={12} color={colors.inkFaint} />}
  </Pressable>
);

const OptionSheet = ({ visible, title, options, activeId, onSelect, onClose }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable
      onPress={onClose}
      style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
    >
      <Pressable
        onPress={() => {}}
        style={{
          backgroundColor: colors.bg,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: '65%',
          paddingBottom: 24,
        
        }}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.marqueeDim,
          }}
        >
          <Text style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 20, color: colors.ink }}>
            {title}
          </Text>
        </View>
        <FlatList
          data={options}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const active = String(item.id) === String(activeId);
            return (
              <Pressable
                onPress={() => onSelect(item.id)}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: active ? colors.surface : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
                    fontSize: 14,
                    color: active ? colors.marquee : colors.ink,
                  }}
                >
                  {item.label}
                </Text>
                {active && <Feather name="check" size={16} color={colors.marquee} />}
              </Pressable>
            );
          }}
        />
      </Pressable>
    </Pressable>
  </Modal>
);

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [type, setType] = useState('movie');
  const [genre, setGenre] = useState('28');
  const [country, setCountry] = useState('US');
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [sortId, setSortId] = useState('1');
  const [rating, setRating] = useState('');

  const [openSheet, setOpenSheet] = useState(null); // 'type' | 'year' | 'sort' | 'genre' | 'country' | 'rating' | null

  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const loadingMoreRef = useRef(false);
  const filtersKey = `${type}-${genre}-${country}-${year}-${sortId}-${rating}`;

  const isAnime = genre === '16' && type === 'tv';
  const genreList = type === 'movie' ? movieGenre : tvGenre;
  const genreOptions = useMemo(
    () => genreList.map((g) => ({ id: String(g.id), label: g.name })),
    [genreList]
  );
  const countryOptions = useMemo(() => countries.map((c) => ({ id: c.code, label: c.name })), []);
  const sortDropdownOptions = useMemo(() => sortOptions.map((s) => ({ id: s.id, label: s.label })), []);
  const ratingDropdownOptions = useMemo(
    () => ratingOptions.map((r) => ({ id: r.value || 'any', label: r.label })),
    []
  );
  const yearOptions = useMemo(() => YEARS.map((y) => ({ id: String(y), label: String(y) })), []);

  // Reset to page 1 and refetch fresh whenever any filter changes.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setPage(1);
      try {
        const params = buildDiscoverParams({ type, genre, country, year, sortId, page: 1, rating });
        const res = await api.get(`/3/discover/${type}`, params);
        if (cancelled) return;
        setResults(res?.results ?? []);
        setTotalPages(Math.min(res?.total_pages ?? 0, TMDB_MAX_PAGE));
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load browse results:', err);
        setError(err instanceof ApiError ? err.message : "Couldn't load results — try again.");
        setResults([]);
        setTotalPages(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [filtersKey]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMoreRef.current) return;
    if (page >= totalPages) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const params = buildDiscoverParams({ type, genre, country, year, sortId, page: nextPage, rating });
      const res = await api.get(`/3/discover/${type}`, params);
      const seen = new Set(results.map((r) => r.id));
      const fresh = (res?.results ?? []).filter((r) => !seen.has(r.id));
      setResults((prev) => [...prev, ...fresh]);
      setPage(nextPage);
    } catch (err) {
      console.error('Failed to load more:', err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [loading, page, totalPages, type, genre, country, year, sortId, rating, results]);

  const filterConfig = [
    { id: 'type', label: type === 'movie' ? 'Movies' : 'TV Shows' },
    { id: 'year', label: year },
    { id: 'sort', label: sortDropdownOptions.find((s) => s.id === sortId)?.label ?? 'Sort by' },
    !isAnime && { id: 'genre', label: genreOptions.find((g) => g.id === genre)?.label ?? 'Genre' },
    { id: 'country', label: isAnime ? 'Japan (Anime)' : countryOptions.find((c) => c.id === country)?.label ?? 'Country', disabled: isAnime },
    { id: 'rating', label: rating ? `${rating}+ Rating` : 'Any Rating' },
  ].filter(Boolean);

  const sheetContentFor = (id) => {
    switch (id) {
      case 'type':
        return {
          title: 'Type',
          options: [
            { id: 'movie', label: 'Movies' },
            { id: 'tv', label: 'TV Shows' },
          ],
          activeId: type,
          onSelect: (val) => {
            setType(val);
            // Switching type can leave an invalid genre id selected (movie
            // and tv genre ids overlap but aren't identical) — reset it.
            setGenre((val === 'movie' ? movieGenre : tvGenre)[0]?.id?.toString() ?? '');
            setOpenSheet(null);
          },
        };
      case 'year':
        return { title: 'Year', options: yearOptions, activeId: year, onSelect: (v) => { setYear(v); setOpenSheet(null); } };
      case 'sort':
        return { title: 'Sort by', options: sortDropdownOptions, activeId: sortId, onSelect: (v) => { setSortId(v); setOpenSheet(null); } };
      case 'genre':
        return { title: 'Genre', options: genreOptions, activeId: genre, onSelect: (v) => { setGenre(v); setOpenSheet(null); } };
      case 'country':
        return { title: 'Country', options: countryOptions, activeId: country, onSelect: (v) => { setCountry(v); setOpenSheet(null); } };
      case 'rating':
        return {
          title: 'Rating',
          options: ratingDropdownOptions,
          activeId: rating || 'any',
          onSelect: (v) => { setRating(v === 'any' ? '' : v); setOpenSheet(null); },
        };
      default:
        return null;
    }
  };
  const activeSheet = openSheet ? sheetContentFor(openSheet) : null;

  const handleScroll = useCallback(
    ({ nativeEvent }) => {
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
      if (distanceFromBottom < 400) loadMore();
    },
    [loadMore]
  );

  return (
    <View className="flex-1 px-4 bg-bg" style={{ paddingTop: insets.top }}>
      <View className=" pt-3 pb-3">
        <Text style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 32, color: colors.ink }}>
          Browse
        </Text>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={filterConfig}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{  gap: 8 }}
        style={{ flexGrow: 0, marginBottom: 20, paddingBottom: 10 }}
        renderItem={({ item }) => (
          <FilterPill label={item.label} disabled={item.disabled} onPress={() => setOpenSheet(item.id)} />
        )}
      />

      {loading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: H_PADDING }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: (undefined),
              }}
            />
          ))}
        </View>
      ) : null}

      {!loading && error && (
        <Text style={{ color: '#f87171', textAlign: 'center', marginTop: 40, paddingHorizontal: 24, fontFamily: 'Inter_400Regular' }}>
          {error}
        </Text>
      )}

      {!loading && !error && results.length === 0 && (
        <Text
          style={{ color: colors.inkFaint, textAlign: 'center', marginTop: 40, paddingHorizontal: 24, fontFamily: 'Inter_400Regular' }}
        >
          Nothing matches these filters yet — try widening the year or clearing a filter.
        </Text>
      )}

      {!loading && !error && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item, i) => `${type}-${item.id}-${i}`}
          numColumns={3}
          columnWrapperStyle={{  justifyContent: 'flex-start', gap: GAP }}
          contentContainerStyle={{ paddingBottom: 24, gap: GAP }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <GridPosterCard
              data={{ ...item, media_type: type }}
              onPress={(data) => navigation.navigate('Details', { id: data.id, type })}
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

      {activeSheet && (
        <OptionSheet
          visible
          title={activeSheet.title}
          options={activeSheet.options}
          activeId={activeSheet.activeId}
          onSelect={activeSheet.onSelect}
          onClose={() => setOpenSheet(null)}
        />
      )}
    </View>
  );
}