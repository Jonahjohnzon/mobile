import React, { memo } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const MONETAG_ZONE_ID = '11576980';

const adHtml = `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <script>
      (function(s){
        s.dataset.zone = '${MONETAG_ZONE_ID}';
        s.src = 'https://nap5k.com/tag.min.js';
      })([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));
    </script>
  </body>
</html>
`;

// memo() so this WebView doesn't remount (and re-fire the ad tag) every
// time HomeScreen re-renders from unrelated state changes like refreshing.
function MonetagAd({ height = 50 }) {
  return (
    <View style={{ width: '100%', height, backgroundColor: 'transparent' }}>
      <WebView
        originWhitelist={['*']}
        source={{ html: adHtml }}
        style={{ backgroundColor: 'transparent' }}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        androidLayerType="software"
        mixedContentMode="always"
      />
    </View>
  );
}

export default memo(MonetagAd);