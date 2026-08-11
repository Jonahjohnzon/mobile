import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../constants/theme';

const Stat = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 8, minWidth: '33%' }}>
      <Text
        style={{
          fontFamily: 'JetBrainsMono_500Medium',
          fontSize: 9,
          letterSpacing: 1,
          color: colors.inkFaint,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={2}
        style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.ink, marginTop: 2 }}
      >
        {value}
      </Text>
    </View>
  );
};

const formatMoney = (n) => (n ? `$${n.toLocaleString('en-US')}` : null);

// Direct port of the web app's InfoStats.js — same fields, same
// movie-vs-tv branching (budget/revenue only for movies, season count
// only for tv), rendered as a bordered strip like a ticket's fine print.
const InfoStats = ({ detail, type }) => {
  if (!detail) return null;

  const originalLanguage = detail.original_language?.toUpperCase();
  const companies = detail.production_companies
    ?.map((c) => c.name)
    .filter(Boolean)
    .join(', ');
  const seasonsInfo =
    type === 'tv'
      ? `${detail.number_of_seasons ?? '-'} season${detail.number_of_seasons === 1 ? '' : 's'}, ${
          detail.number_of_episodes ?? '-'
        } episodes`
      : null;

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.line,
        marginHorizontal: 16,
        marginTop: 20,
        paddingVertical: 4,
      }}
    >
      <Stat label="Status" value={detail.status} />
      <Stat label="Language" value={originalLanguage} />
      {type === 'movie' && <Stat label="Budget" value={formatMoney(detail.budget)} />}
      {type === 'movie' && <Stat label="Revenue" value={formatMoney(detail.revenue)} />}
      {seasonsInfo && <Stat label="Seasons" value={seasonsInfo} />}
      {companies && <Stat label="Production" value={companies} />}
    </View>
  );
};

export default InfoStats;
