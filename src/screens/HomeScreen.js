import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/ApiCore';
import HeroBanner from '../components/HeroBanner';
import TicketDivider from '../components/TicketDivider';
import ContentRow from '../components/ContentRow';
import TrailerSpotlight from '../components/TrailerSpotlight';
import MonetagAd from '../components/MonetagAd';
import { colors } from '../constants/theme';

// Same config-driven row list as the web Home.jsx — adding a category is
// still a one-line addition here. `rank: true` marks the row that gets
// numbered marquee badges instead of the plain poster treatment.
const ROWS = [
  {
    key: 'trending',
    title: 'Trending Today',
    eyebrow: '01',
    type: 'movie',
    endpoint: '/3/trending/movie/day?language=en-US',
    heroSource: true,
    rank: true,
  },
  { key: 'series', title: 'Series Today', eyebrow: '02', type: 'tv', endpoint: '/3/trending/tv/day?language=en-US' },
  {
    key: 'kseries',
    title: 'K-Drama',
    eyebrow: '03',
    type: 'tv',
    endpoint:
      '/3/discover/tv?include_adult=false&include_null_first_air_dates=false&language=ko-KR&page=1&sort_by=popularity.desc&with_origin_country=KR&without_genres=10764,99,10767',
  },
  {
    key: 'popularTv',
    title: 'Popular List',
    eyebrow: '04',
    type: 'tv',
    endpoint: '/3/discover/tv?include_adult=false&language=en-US&page=1&sort_by=vote_average.desc&vote_count.gte=200',
  },
  {
    key: 'nowPlaying',
    title: 'In Theaters',
    eyebrow: '05',
    type: 'movie',
    endpoint: '/3/movie/now_playing?language=en-US&page=1',
  },
  {
    key: 'upcoming',
    title: 'Upcoming',
    type: 'movie',
    endpoint: '/3/movie/upcoming?language=en-US&page=1',
    render: 'trailer',
  },
  {
    key: 'anime',
    title: 'Anime',
    eyebrow: '06',
    type: 'tv',
    endpoint: '/3/discover/tv?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&with_genres=16&with_origin_country=JP',
  },
  {
    key: 'action',
    title: 'Action',
    eyebrow: '07',
    type: 'movie',
    endpoint: '/3/discover/movie?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&with_genres=28',
  },
  {
    key: 'topRated',
    title: 'Top Rated',
    eyebrow: '08',
    type: 'movie',
    endpoint: '/3/movie/top_rated?language=en-US&page=1',
  },
];

export default function HomeScreen() {
  const navigation = useNavigation();
  const [dataByKey, setDataByKey] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allFailed, setAllFailed] = useState(false);

  const getData = useCallback(async () => {
    // Same Promise.allSettled approach as the web app: every row fetches
    // in parallel and independently, so one broken category can't hold up
    // or take down the rest of the screen.
    const results = await Promise.allSettled(ROWS.map((row) => api.get(row.endpoint)));

    const next = {};
    let failures = 0;
    results.forEach((result, i) => {
      const { key } = ROWS[i];
      if (result.status === 'fulfilled') {
        next[key] = result.value?.results ?? [];
      } else {
        console.error(`Failed to load "${key}":`, result.reason);
        next[key] = [];
        failures += 1;
      }
    });

    setDataByKey(next);
    setAllFailed(failures === ROWS.length);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await getData();
      setLoading(false);
    })();
  }, [getData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await getData();
    setRefreshing(false);
  };

  const handleItemPress = ({ type, data }) => {
    navigation.navigate('Details', { id: data.id, type });
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.marquee} size="large" />
      </SafeAreaView>
    );
  }

  const heroRow = ROWS.find((r) => r.heroSource);
  const heroList = dataByKey[heroRow?.key] ?? [];

  // edges={['top']} only — we deliberately don't reserve the bottom inset
  // here since that's handled by the tab bar / bottom nav, not this screen.
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={colors.marquee} refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <HeroBanner
          items={heroList}
          onPressPlay={(m) => navigation.navigate('Details', { id: m.id, type: 'movie' })}
          onPressInfo={(m) => navigation.navigate('Details', { id: m.id, type: 'movie' })}
        />
        {/* <TicketDivider /> */}

        {/* <MonetagAd height={50} /> */}

        {allFailed && (
          <View className="px-4 py-10 items-center">
            {/* Kept intentionally quiet — a full-screen redirect makes
                less sense on mobile than it did as a web route change. */}
          </View>
        )}

        {ROWS.map((row) => {
          if (row.render === '') {
            return <TrailerSpotlight key={row.key} trailers={dataByKey[row.key] ?? []} />;
          }
          return (
            <ContentRow
              key={row.key}
              data={dataByKey[row.key] ?? []}
              title={row.title}
              eyebrow={row.eyebrow}
              type={row.type}
              mode="details"
              showRank={!!row.rank}
              onPressItem={handleItemPress}
            />
          );
        })}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}