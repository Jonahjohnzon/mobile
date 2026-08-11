import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import * as yup from 'yup';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { login, setToken } from '../lib/screenOppsApi';
import { state } from '../store/state';
import { colors } from '../constants/theme';

const Schema = yup.object({
  email: yup.string().email('Enter a valid email').required('Email is required'),
  password: yup.string().min(1).max(15).required('Password is required'),
});

const AuthField = ({ label, value, onChangeText, error, ...props }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: colors.inkFaint, marginBottom: 6 }}>
      {label}
    </Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholderTextColor={colors.inkFaint}
      autoCapitalize="none"
      style={{
        height: 46,
        borderRadius: 10,
        paddingHorizontal: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: error ? '#f87171' : colors.marqueeDim,
        color: colors.ink,
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
      }}
      {...props}
    />
    {!!error && (
      <Text style={{ color: '#f87171', fontSize: 11, marginTop: 4, fontFamily: 'Inter_400Regular' }}>
        {error}
      </Text>
    )}
  </View>
);

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setMessage(null);
    try {
      await Schema.validate({ email, password }, { abortEarly: false });
      setErrors({});
    } catch (validationErr) {
      const fieldErrors = {};
      validationErr.inner.forEach((e) => { fieldErrors[e.path] = e.message; });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const info = await login({ email, password });
      setIsError(!info?.success);
      setMessage(info?.message);
      if (info?.success) {
        if (info.token) await setToken(info.token);
        state.log = true;
        state.name = info?.data?.user_name ?? info?.data?.name ?? null;
        state.id = info?.data?._id ?? null;
        navigation.goBack();
      }
    } catch (e) {
      setIsError(true);
      setMessage('Something went wrong — try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
        <View className="px-5 pt-4 pb-2 flex-row items-center">
          <Pressable
            onPress={() => navigation.goBack()}
            className="rounded-full items-center justify-center"
            style={{ width: 36, height: 36, backgroundColor: colors.surface }}
          >
            <Feather name="chevron-left" size={20} color={colors.ink} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 34, color: colors.ink, marginBottom: 24 }}>
            Log In
          </Text>

          {!!message && (
            <Text
              style={{ marginBottom: 16, fontFamily: 'Inter_400Regular', fontSize: 13, color: isError ? '#f87171' : colors.marquee }}
            >
              {message}
            </Text>
          )}

          <AuthField label="EMAIL" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" />
          <AuthField label="PASSWORD" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry placeholder="•••••" />

          {loading ? (
            <View style={{ paddingVertical: 14, alignItems: 'center' }}>
              <ActivityIndicator color={colors.marquee} />
            </View>
          ) : (
            <Pressable
              onPress={handleSubmit}
              style={{ backgroundColor: colors.ticket, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' }}>LOG IN</Text>
            </Pressable>
          )}

          <Pressable onPress={() => navigation.navigate('SignUp')} style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.inkFaint }}>
              Don't have an account? <Text style={{ color: colors.marquee }}>Sign up</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}