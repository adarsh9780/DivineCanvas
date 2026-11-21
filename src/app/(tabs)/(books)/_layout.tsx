import React from 'react';
import { Stack } from 'expo-router';
export default function BooksLayout() {return <Stack screenOptions={{headerShown:false}}><Stack.Screen name="index"/><Stack.Screen name="chapters" options={{headerShown:true}}/></Stack>;}
