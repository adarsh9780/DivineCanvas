import React from 'react';
import { Stack } from 'expo-router';
export default function BooksLayout() {return <Stack screenOptions={{headerShown:false}}><Stack.Screen name="index"/><Stack.Screen name="chapters" options={{headerShown:true}}/><Stack.Screen name="note-editor" options={{presentation:"formSheet",sheetAllowedDetents:[0.85,1],sheetGrabberVisible:true,sheetLargestUndimmedDetentIndex:"last",contentStyle:{backgroundColor:"transparent"}}}/></Stack>;}
