import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Modal, FlatList } from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { colors } from '../constants/theme'; // Assuming you have theme colors defined
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Placeholder player screen. The web app pointed `/stream/:type/:id/:s/:e`
 * at a third-party source resolver that isn't part of the code you shared,
 * so this renders a WebView shell wired to the same route params —
 * swap `playerUri` for whatever source URL your resolver returns.
 */

// Known ad / tracking / popup-network domains. Not exhaustive — extend with
// a maintained list (e.g. a trimmed EasyList subset) if you need more coverage.
const BLOCKED_DOMAINS = [
  // Google / DoubleClick ad stack
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googletagservices.com',
  'pagead2.googlesyndication.com',
  'adservice.google.co.uk',

  // Programmatic / display ad networks
  'adnxs.com',
  'adsrvr.org',
  'adform.net',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'casalemedia.com',
  'contextweb.com',
  'sharethrough.com',
  'smartadserver.com',
  'criteo.com',
  'criteo.net',
  'bidswitch.net',
  'yieldmo.com',
  'media.net',

  // Pop-under / redirect / "push notification" ad networks
  // (common on free video-embed and file-host sites)
  'popads.net',
  'popcash.net',
  'propellerads.com',
  'propellerclick.com',
  'exoclick.com',
  'exosrv.com',
  'juicyads.com',
  'trafficjunky.net',
  'adskeeper.com',
  'mgid.com',
  'onclickmax.com',
  'onclickalgo.com',
  'adsterra.com',
  'a-ads.com',
  'clickadu.com',
  'hilltopads.net',
  'yllix.com',
  'adcash.com',
  'bidvertiser.com',
  'clicksor.com',
  'popmyads.com',
  'poptox.com',
  'admaven.com',
  'adexchangecloud.com',
  'zeropark.com',
  'trafficstars.com',
  'trafficfactory.biz',
  'galaksion.com',
  'richads.com',
  'evadav.com',
  'adcolony.com',
  'zedo.com',
  'yandex.ru/ads',
  'smartyads.com',
  'clickaine.com',
  'adsyield.com',
  'kadam.net',
  'monetag.com',
  'gomonetize.com',
  'realsrv.com',
  'imasdk.googleapis.com',

  // Content-recommendation / chum-box networks
  'taboola.com',
  'outbrain.com',
  'revcontent.com',
  'content.ad',
  'adblade.com',

  // Analytics / tracking / fingerprinting
  'scorecardresearch.com',
  'histats.com',
  'moatads.com',
  'quantserve.com',
  'hotjar.com',
  'mouseflow.com',
  'clarity.ms',
  'newrelic.com',
  'sentry.io',
  'bugsnag.com',
  'branch.io',
  'adjust.com',
  'appsflyer.com',
  'amplitude.com',
  'mixpanel.com',
  'segment.io',
  'segment.com',

  // Social widget / share trackers (often just tracking pixels in embeds)
  'facebook.net',
  'connect.facebook.net',
];

// Injected after every page load: removes common ad containers, kills
// popup/redirect attempts, and neutralizes window.open hijacking that
// shady embed players use to spawn new tabs on tap.
const AD_BLOCK_JS = `
(function () {
  try {
    // Neutralize popup/redirect hijacking
    window.open = function () { return null; };
    window.alert = function () {};
    window.confirm = function () { return false; };

    // Remove elements commonly used for ad overlays / interstitials
    var selectors = [
      '[id*="ad-" i]', '[class*="ad-" i]',
      '[id*="ads" i]', '[class*="ads" i]',
      '[id*="banner" i]', '[class*="banner" i]',
      '[id*="popup" i]', '[class*="popup" i]',
      '[id*="sponsor" i]', '[class*="sponsor" i]',
      'iframe[src*="doubleclick"]',
      'iframe[src*="googlesyndication"]',
    ];
    function sweep() {
      selectors.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) {
          el.remove();
        });
      });
    }
    sweep();

    // Sites re-inject ad nodes after load / on interval — keep sweeping
    var observer = new MutationObserver(sweep);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    true;
  } catch (e) {
    true;
  }
})();
`;

// Injected before the page paints: strips the "this is a webpage" tells —
// scrollbars, text selection, long-press callouts, pinch zoom, tap
// highlight — so the embed reads as part of the app's own UI.
const CHROME_RESET_JS = `
(function () {
  try {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';

    var style = document.createElement('style');
    style.innerHTML = \`
      html, body {
        background: #000 !important;
        overscroll-behavior: none !important;
      }
      ::-webkit-scrollbar { display: none !important; }
      * {
        -webkit-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      video {
        width: 100% !important;
        height: 100% !important;
        object-fit: contain !important;
        background: #000 !important;
      }
    \`;
    document.documentElement.appendChild(style);

    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    true;
  } catch (e) {
    true;
  }
})();
`;

function isBlockedUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return BLOCKED_DOMAINS.some((domain) => host === domain || host.endsWith('.' + domain));
  } catch (e) {
    return false;
  }
}

const FULLSCREEN_WATCH_JS = `
  (function() {
    document.addEventListener('fullscreenchange', function() {
      const isFullscreen = !!document.fullscreenElement;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'fullscreen', value: isFullscreen }));
    });
    document.addEventListener('webkitfullscreenchange', function() {
      const isFullscreen = !!document.webkitFullscreenElement;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'fullscreen', value: isFullscreen }));
    });
    true;
  })();
`;

function handleWebViewMessage(event) {
  try {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'fullscreen') {
      if (data.value) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    }
  } catch {
    // ignore non-JSON messages from other injected scripts
  }
}

export default function StreamBScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const webviewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [selectedApi, setSelectedApi] = useState("BACKUP-SERVER");

  const { id, type, season, episode } = params ?? {};



  // reset to portrait when leaving this screen
  useEffect(() => {
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);



  const hasValidParams =
    id != null &&
    (type === 'tv' ? season != null && episode != null : true);

  // Define StreamApi here or pass it as a prop/context
    const StreamApi = hasValidParams
      ? [
              {
            Name: "BACKUP-SERVER",
            scrMovie: `https://www.vidy.st/movie/${id}?color=DC2626`,
            scrSeries: `https://www.vidy.st/tv/${id}/${season}/${episode}?color=DC2626`,
            scrAnimeMovie: `https://player.videasy.net/anime/anilist_id`,
            scrAnimeSeries: `https://player.videasy.net/anime/anilist_id/${episode}`,
            id: 1,
          }
        ]
      : [];

  // Find the currently selected API object
  const currentApi = StreamApi.find(api => api.Name === selectedApi) || StreamApi[0];

  // Determine the player URI based on type and selected API
  const playerUri = hasValidParams
    ? (type === "tv" ? currentApi.scrSeries : currentApi.scrMovie)
    : null;

  const handleShouldStartLoad = useCallback((request) => {
    if (isBlockedUrl(request.url)) {
      return false;
    }
    return true;
  }, []);


  

  // --- Rendering ---
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={20} color={colors.ink} />
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.ink }}>
            Back
          </Text>
        </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      </View>
      </View>

      {playerUri ? (
        <View style={{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }}>
          <WebView
            ref={webviewRef}
            source={{ uri: playerUri }}
            style={{ flex: 1, backgroundColor: '#000' }}
            allowsFullscreenVideo
            javaScriptEnabled
            domStorageEnabled
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            allowsLinkPreview={false}
            injectedJavaScriptBeforeContentLoaded={CHROME_RESET_JS}
            injectedJavaScript={`${AD_BLOCK_JS}\n${FULLSCREEN_WATCH_JS}`}
            onMessage={handleWebViewMessage}
            onLoadEnd={() => {
              setLoading(false);
              webviewRef.current?.injectJavaScript(CHROME_RESET_JS);
              webviewRef.current?.injectJavaScript(AD_BLOCK_JS);
            }}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onOpenWindow={() => {}}
            setSupportMultipleWindows={false}
          />
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={colors.ink ?? '#fff'} />
            </View>
          )}
        </View>
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <Feather name="film" size={26} color={colors.inkFaint} />
          <Text className="text-inkFaint text-center mt-3" style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}>
            Player not wired up yet — connect your streaming source for {type} #{id} {type === 'tv' ? `S${season}E${episode}` : ''}.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 40, // Adjust for status bar height if needed
    paddingBottom: 16,
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: colors.black,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200, // Adjust color as needed
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serverDropdownContainer: {
    position: 'relative',
  },
  serverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 4,
  },
  serverButtonText: {
    fontSize: 14,
    color: colors.ink,
    fontFamily: 'Inter_500Medium', // Ensure you have this font
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 4,
    width: 150, // Adjust width as needed
    maxHeight: 200, // Max height for the dropdown list
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectedDropdownItem: {
    backgroundColor: colors.surface, // Darker background for selected item
  },
  dropdownItemText: {
    fontSize: 14,
    color: colors.ink,
    fontFamily: 'Inter_400Regular', // Ensure you have this font
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
});