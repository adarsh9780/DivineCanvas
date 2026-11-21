import React from 'react';
import { Stack } from 'expo-router';
export const unstable_settings = {initialRouteName:'index'};
export default function SettingsLayout() {return <Stack screenOptions={{headerShown:false}}><Stack.Screen name="index"/><Stack.Screen name="[page]"/></Stack>;}
