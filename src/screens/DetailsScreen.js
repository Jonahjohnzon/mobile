import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSnapshot } from 'valtio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/ApiCore';
import { pushWishlist, getWishlistId } from '../lib/screenOppsApi';
import { state } from '../store/state';
import TicketDivider from '../components/TicketDivider';
import ContentRow from '../components/ContentRow';
import InfoStats from '../components/InfoStats';
import CastRow from '../components/CastRow';
import SeasonChips from '../components/SeasonChips';
import EpisodeList from '../components/EpisodeList';
import ReadMoreText from '../components/ReadMoreText';
import { colors } from '../constants/theme';

const WishlistButton = ({ onPress, loading, added }) => {
  if (added) {
    return (
      <View
        className="flex-row items-center justify-center rounded-full py-3.5 mt-3"
        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.marqueeDim }}
      >
        <Feather name="check" size={16} color={colors.marquee} />
        <Text className="ml-2" style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.marquee }}>
          In Wishlist
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      className="flex-row items-center justify-center rounded-full py-3.5 mt-3"
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.marqueeDim, opacity: loading ? 0.6 : 1 }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.ink} />
      ) : (
        <>
          <Feather name="plus" size={16} color={colors.ink} />
          <Text className="ml-2" style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.ink }}>
            Add to Wishlist
          </Text>
        </>
      )}
    </Pressable>
  );
};

export default function DetailsScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { id, type } = params ?? {};
  const wishload = useSnapshot(state).wishload;

  const [detail, setDetail] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [cast, setCast] = useState([]);
  const [loading, setLoading] = useState(true);

  const [wishlistIds, setWishlistIds] = useState([]);
  const [wishAdded, setWishAdded] = useState(false);

  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  // Detail + similar + credits + wishlist ids fetch together, same
  // Promise.allSettled pattern used everywhere else in this app — one
  // failing endpoint doesn't block the others from rendering.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setWishAdded(false);
      try {
        const [detailRes, similarRes, creditsRes, wishlistRes] = await Promise.allSettled([
          api.get(`/3/${type}/${id}?language=en-US`),
          api.get(`/3/${type}/${id}/similar?language=en-US&page=1`),
          api.get(`/3/${type}/${id}/credits?language=en-US`),
          getWishlistId(),
        ]);
        if (cancelled) return;
        if (detailRes.status === 'fulfilled') setDetail(detailRes.value);
        if (similarRes.status === 'fulfilled') setSimilar(similarRes.value?.results ?? []);
        if (creditsRes.status === 'fulfilled') setCast(creditsRes.value?.cast ?? []);
        if (wishlistRes.status === 'fulfilled') setWishlistIds(wishlistRes.value || []);
      } catch (err) {
        console.error('Failed to load details:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, type]);

  const loadSeason = useCallback(
    async (seasonNumber) => {
      if (type !== 'tv') return;
      setEpisodesLoading(true);
      try {
        const res = await api.get(`/3/tv/${id}/season/${seasonNumber}?language=en-US`);
        setEpisodes(res?.episodes ?? []);
      } catch (err) {
        console.error('Failed to load season:', err);
        setEpisodes([]);
      } finally {
        setEpisodesLoading(false);
      }
    },
    [id, type]
  );

  // Once the show's total season count is known, default to Season 1 and
  // fetch its episode list — mirrors the web app defaulting `part` to 1.
  useEffect(() => {
    if (type === 'tv' && detail?.number_of_seasons) {
      setSelectedSeason(1);
      loadSeason(1);
    }
  }, [type, detail?.number_of_seasons, loadSeason]);

  const handleSelectSeason = (s) => {
    setSelectedSeason(s);
    loadSeason(s);
  };

  const handlePlay = async (season = '1', episode = '1') => {
    try {
      const raw = await AsyncStorage.getItem('recentlyWatched');
      const list = raw ? JSON.parse(raw) : [];
      const entry = { ...detail, id, media_type: type, season: String(season), episode: String(episode) };
      const next = [entry, ...list.filter((x) => x.id !== id)].slice(0, 20);
      await AsyncStorage.setItem('recentlyWatched', JSON.stringify(next));
    } catch (err) {
      console.error("Couldn't update recently-watched:", err);
    }
    navigation.navigate('Stream', { id, type, season: String(season), episode: String(episode) });
  };

  const handleWishlist = async () => {
    const body = {
      id: detail?.id,
      media_type: type,
      poster_path: detail?.poster_path,
      name: detail?.name,
      original_name: detail?.original_name,
      title: detail?.title,
      vote_average: detail?.vote_average,
      season: '1',
      episode: '1',
    };
    const success = await pushWishlist(body);
    if (success) setWishAdded(true);
  };

  if (loading || !detail) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator color={colors.marquee} />
      </View>
    );
  }

  const imageBase = process.env.EXPO_PUBLIC_SIZEIMAGEPHONE;
  const title = detail.title || detail.name;
  const backdrop = detail.backdrop_path ? `${imageBase}${detail.backdrop_path}` : null;
  const seasons =
    type === 'tv' && detail.number_of_seasons
      ? Array.from({ length: detail.number_of_seasons }, (_, i) => i + 1)
      : [];
  const isWishlisted = wishAdded || wishlistIds.includes(id);

  return (
    <View className="flex-1 bg-bg">
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingTop: 9,
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
      <ScrollView className="flex-1 bg-bg" showsVerticalScrollIndicator={false}>
        <View style={{ height: 320 }}>
          {backdrop ? (
            <Image source={{ uri: backdrop }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ width: '100%', height: '100%', backgroundColor: colors.surface }} />
          )}
          <LinearGradient
            colors={['rgba(11,13,16,0.4)', colors.bg]}
            locations={[0.4, 1]}
            style={{ position: 'absolute', inset: 0 }}
          />
        </View>

        {/* <TicketDivider /> */}

        <View className="px-4">
          <Text style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 34, color: colors.ink }}>{title}</Text>

          <View className="flex-row items-center mt-2">
            <Feather name="star" size={13} color={colors.marquee} />
            <Text
              className="ml-1 mr-3"
              style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 12, color: colors.inkMuted }}
            >
              {Math.ceil(detail.vote_average || 0)}/10
            </Text>
            {!!detail.runtime && (
              <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 12, color: colors.inkMuted }}>
                {detail.runtime} min
              </Text>
            )}
          </View>

          <View className="flex-row flex-wrap mt-3">
            {(detail.genres ?? []).map((g) => (
              <View key={g.id} className="rounded-full px-3 py-1 mr-2 mb-2" style={{ backgroundColor: colors.surface }}>
                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: colors.inkMuted }}>{g.name}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => handlePlay()}
            className="flex-row items-center justify-center rounded-full py-3.5 mt-4"
            style={{ backgroundColor: colors.marquee }}
          >
            <Feather name="play" size={16} color={colors.bg} />
            <Text className="ml-2" style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.bg }}>
              Play
            </Text>
          </Pressable>

          <WishlistButton onPress={handleWishlist} loading={!!wishload} added={isWishlisted} />

          <View className="mt-5">
            <ReadMoreText
              style={{ fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, color: colors.inkMuted }}
            >
              {detail.overview || 'No synopsis available.'}
            </ReadMoreText>
          </View>
        </View>

        <InfoStats detail={detail} type={type} />

        <View className="mt-8">
          <CastRow
            cast={cast}
            onPressPerson={(person) =>
              navigation.push('Actor', { id: person.id, name: person.name })
            }
          />
        </View>

        {type === 'tv' && seasons.length > 0 && (
          <View className="mt-2 px-4">
            <SeasonChips seasons={seasons} selected={selectedSeason} onSelect={handleSelectSeason} />
            {episodesLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator color={colors.marquee} />
              </View>
            ) : (
              <EpisodeList
                episodes={episodes}
                onPressEpisode={(ep) => handlePlay(selectedSeason, ep.episode_number)}
              />
            )}
          </View>
        )}

        <View className="mt-8">
          <ContentRow
            data={similar}
            title="More Like This"
            eyebrow=""
            type={type}
            mode="details"
            onPressItem={({ type: t, data }) => navigation.push('Details', { id: data.id, type: t })}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}