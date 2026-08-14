import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
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

const AD_URL = 'https://screenopps.com/ads';

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
  const insets = useSafeAreaInsets();
  const { id, type } = params ?? {};
  const wishload = useSnapshot(state).wishload;

  const [detail, setDetail] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [cast, setCast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closeCountdown, setCloseCountdown] = useState(15);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [wishAdded, setWishAdded] = useState(false);

  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  // ── Ad WebView ────────────────────────────────────────────────────────
  // The WebView below is mounted ONCE, unconditionally, for the lifetime
  // of this screen — it's never inside a Modal or an `{adVisible && ...}`
  // block. We only toggle its on-screen visibility (opacity/zIndex/
  // pointerEvents). This means:
  //   - It starts loading as soon as the screen mounts (prefetch), instead
  //     of only starting when the user taps Play.
  //   - Tapping Play reuses the SAME native WebView instance (see
  //     handlePlay below) instead of spinning up a fresh one each time,
  //     which was the main source of the "slower than a browser" feeling.
  //     handlePlay calls .reload() so each shown ad is still a genuine
  //     fresh pageview/impression, just without the cold native-instance
  //     cost — DNS/TLS/disk-cache/cookies all stay warm across reloads.
  const [adVisible, setAdVisible] = useState(false);
  const [adReady, setAdReady] = useState(false);
  const adWebViewRef = useRef(null);
  const pendingPlayRef = useRef({ season: '1', episode: '1' });

  // Per-session cooldown so rapid repeat Play taps can't spam-reload the
  // ad and fire multiple impressions in quick succession — networks like
  // Monetag can flag that as invalid/abusive traffic. If Play is tapped
  // again inside the cooldown window, we skip re-showing the ad entirely
  // and go straight to the player.
  const lastAdShownRef = useRef(0);
  const AD_COOLDOWN_MS = 60000; // 60s between ad impressions

  // Mirrors `closeCountdown` state, but read synchronously inside the
  // hardwareBackPress handler below. That handler is registered once per
  // `adVisible` toggle (see the effect's dependency array), so if it read
  // `closeCountdown` directly via closure it would be stuck on whatever
  // value existed at registration time (15) — always > 0 — letting back
  // skip the ad on the very first press, every time. The ref always holds
  // the live value, so the handler can gate on the real current countdown.
  const closeCountdownRef = useRef(15);

  useEffect(() => {
    // Temporary debug log — confirms whether this screen itself was ever
    // opened without a valid id/type. If this logs undefined, the bug is
    // in whatever screen navigated to Details, not in this file.
    console.log('[Details] route.params:', params);
  }, [params]);

  // Detail + similar + credits + wishlist ids fetch together, same
  // Promise.allSettled pattern used everywhere else in this app — one
  // failing endpoint doesn't block the others from rendering.
  useEffect(() => {
    if (id == null || type == null) {
      console.warn('[Details] Missing id/type in route params, skipping fetch:', params);
      setLoading(false);
      return;
    }
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

  // Android hardware back button while the ad overlay is showing must NOT
  // let the user skip the ad early. Previously this called proceedToPlay()
  // unconditionally, which meant: tap Play (fires the ad impression via
  // .reload()) → immediately hit back → land in the player having watched
  // 0 seconds of the ad. That's a straight-up skip button, and it also
  // made the on-screen countdown purely decorative on Android since back
  // bypassed it entirely.
  //
  // Now back is gated on the same condition the X (close) button uses:
  // closeCountdown must have reached 0. Before that, we still consume the
  // back press (return true) so the user doesn't fall through to backing
  // out of the screen underneath — we just don't advance to the player.
  useEffect(() => {
    if (!adVisible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (closeCountdownRef.current > 0) {
        // Ad still "airing" — swallow the back press, ad stays on screen.
        return true;
      }
      proceedToPlay();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adVisible]);

  // Play opens the ad overlay instead of navigating directly. The actual
  // navigation + recently-watched bookkeeping is deferred to proceedToPlay,
  // which runs when the user taps close (or the Android back button, once
  // the countdown has finished).
  //
  // Guarded: if id/type are missing (this screen was opened without valid
  // params) or, for a TV show, season/episode weren't resolved yet, we bail
  // out instead of opening the ad and later navigating to a Stream screen
  // with `undefined` baked into the player URL.
  const handlePlay = (season = '1', episode = '1') => {
    if (id == null || type == null) {
      console.warn('[Details] handlePlay called without valid id/type, aborting:', { id, type });
      return;
    }
    if (type === 'tv' && (season == null || episode == null)) {
      console.warn('[Details] handlePlay called without valid season/episode, aborting:', { season, episode });
      return;
    }
    pendingPlayRef.current = { season: String(season), episode: String(episode) };

    const now = Date.now();
    const withinCooldown = now - lastAdShownRef.current < AD_COOLDOWN_MS;

    if (withinCooldown) {
      // Already showed a real ad impression recently — don't reload/re-fire
      // another one, just take the user straight to the player.
      proceedToPlay();
      return;
    }

    lastAdShownRef.current = now;
    setAdReady(false);
    // Reload forces a genuine fresh pageview/impression on this tap, while
    // still reusing the WebView's warm DNS/TLS/disk-cache from the
    // preloaded instance — see the persistent-WebView note above.
    adWebViewRef.current?.reload();
    setAdVisible(true);
  };

  const proceedToPlay = async () => {
    setAdVisible(false);
    const { season, episode } = pendingPlayRef.current;

    // Belt-and-braces: handlePlay already validated these, but re-check
    // right before navigating in case something cleared params mid-flow.
    if (id == null || type == null) {
      console.warn('[Details] proceedToPlay: missing id/type, not navigating:', { id, type });
      return;
    }

    try {
      const raw = await AsyncStorage.getItem('recentlyWatched');
      const list = raw ? JSON.parse(raw) : [];
      const entry = { ...detail, id, media_type: type, season, episode };
      const next = [entry, ...list.filter((x) => x.id !== id)].slice(0, 20);
      await AsyncStorage.setItem('recentlyWatched', JSON.stringify(next));
    } catch (err) {
      console.error("Couldn't update recently-watched:", err);
    }
    navigation.navigate('Stream', { id, type, season, episode });
  };

  useEffect(() => {
    if (!adVisible) return undefined;
    setCloseCountdown(15);
    closeCountdownRef.current = 15;
    const interval = setInterval(() => {
      setCloseCountdown((prev) => {
        const next = prev <= 1 ? 0 : prev - 1;
        closeCountdownRef.current = next;
        if (next === 0) clearInterval(interval);
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [adVisible]);

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
      <SafeAreaView edges={['bottom', 'left', 'right']} className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator color={colors.marquee} />
      </SafeAreaView>
    );
  }

  const imageBase = process.env.EXPO_PUBLIC_SIZEIMAGEPHONE;
  const title = detail.title || detail.name;
  const backdrop = detail.backdrop_path ? `${imageBase}${detail.backdrop_path}` : null;
  const seasons =
    type === 'tv' && detail.number_of_seasons
      ? Array.from({ length: detail.number_of_seasons }, (_, i) => i + 1)
      : [];
  const isWishlisted = wishAdded || wishlistIds.includes(String(id));

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} className="flex-1 bg-bg">
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingTop: insets.top + 9,
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
                onPressEpisode={(ep) => {
                  // episode_number can be missing/null on malformed API
                  // entries — skip rather than sending an undefined
                  // episode number through to the player.
                  if (ep?.episode_number == null) {
                    console.warn('[Details] Episode missing episode_number, ignoring tap:', ep);
                    return;
                  }
                  handlePlay(selectedSeason, ep.episode_number);
                }}
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

      {/*
        Ad overlay — NOT a <Modal>. Modal remounts/tears down its children
        on visibility changes on some platforms, which was defeating any
        caching/prefetch benefit. This is a plain absolutely-positioned
        View whose visibility is purely a style toggle; the WebView inside
        it is declared once below and never unmounts while this screen is
        alive, so it can preload ahead of the first tap and reuse its
        cache/cookies/connection on every subsequent tap.
      */}
      <View
        pointerEvents={adVisible ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#000',
          paddingTop: insets.top,
          opacity: adVisible ? 1 : 0,
          zIndex: adVisible ? 20 : -1,
        }}
      >
        <WebView
          ref={adWebViewRef}
          source={{ uri: AD_URL }}
          style={{ flex: 1, backgroundColor: '#000' }}
          containerStyle={{ backgroundColor: '#000' }}
          startInLoadingState
          onLoadEnd={() => setAdReady(true)}
          // Caching / cookies — without these, some ad SDKs re-init from
          // scratch on every load instead of reusing warm state, which is
          // a big part of why a system browser tab feels faster.
          cacheEnabled
          cacheMode="LOAD_DEFAULT"
          domStorageEnabled
          javaScriptEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="always"
          renderLoading={() => (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#000',
              }}
            >
              <ActivityIndicator color={colors.marquee} />
            </View>
          )}
        />

        <Pressable
          onPress={closeCountdown === 0 ? proceedToPlay : undefined}
          disabled={closeCountdown > 0}
          hitSlop={10}
          style={{
            position: 'absolute',
            top: insets.top + 10,
            right: 16,
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(20,20,20,0.85)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.4,
            shadowRadius: 4,
            elevation: 6,
          }}
        >
          {closeCountdown > 0 ? (
            <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
              {closeCountdown}
            </Text>
          ) : (
            <Feather name="x" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}