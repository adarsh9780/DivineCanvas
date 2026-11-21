import React, { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { usePreventRemove, useRouter } from 'expo-router';
import { useReaderSections } from '../../../ReaderSections';
import { useAppLanguage } from '../../../AppLanguage';
import { palettes } from '../../../readingAppearance';

export default function NoteEditorScreen() {
  const {noteEditor, colorTheme} = useReaderSections();
  const {appLanguage, t} = useAppLanguage();
  const router = useRouter();
  const colors = palettes[colorTheme];
  const [initial] = useState(noteEditor?.initial ?? '');
  const [note, setNote] = useState(initial);
  const [saving, setSaving] = useState(false);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const close = useRef(noteEditor?.close);

  useEffect(() => {
    // A native sheet may still be presenting when its input first mounts.
    const closeEditor = close.current;
    const focus = setTimeout(() => input.current?.focus(), 450);
    return () => { clearTimeout(focus); Keyboard.dismiss(); closeEditor?.(); };
  }, []);

  const disablePrevention = usePreventRemove(note !== initial, ({repeat}) => {
    const discard = () => { setNote(initial); repeat(); };
    if (Platform.OS === 'web') {
      if (window.confirm(appLanguage === 'hi' ? 'बिना सहेजे बदलाव हटाएँ?' : 'Discard unsaved changes?')) discard();
      return;
    }
    Alert.alert(appLanguage === 'hi' ? 'बदलाव हटाएँ?' : 'Discard changes?',
      appLanguage === 'hi' ? 'आपके बदलाव अभी सहेजे नहीं गए हैं।' : 'Your changes have not been saved.', [
        {text:appLanguage === 'hi' ? 'लिखना जारी रखें' : 'Keep editing', style:'cancel'},
        {text:appLanguage === 'hi' ? 'हटाएँ' : 'Discard', style:'destructive', onPress:discard},
      ]);
  });

  async function save() {
    if (!noteEditor || saving) return;
    setSaving(true);
    const saved = await noteEditor.save(note);
    setSaving(false);
    if (saved) { Keyboard.dismiss(); disablePrevention(); router.back(); }
  }

  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:24,flexGrow:1,backgroundColor:colors.white}}>
    <Text accessibilityRole="header" style={{fontSize:22,fontWeight:'600',color:colors.ink,marginBottom:16}}>{t('Add a note')}</Text>
    <TextInput ref={input} accessibilityLabel={t('Your note')} multiline value={note} onChangeText={setNote} placeholder={t('Write something…')} placeholderTextColor={colors.muted} style={{minHeight:120,textAlignVertical:'top',backgroundColor:colors.paper,borderRadius:12,padding:16,color:colors.ink,fontSize:16}} />
    <Pressable accessibilityRole="button" onPress={Keyboard.dismiss} style={{alignSelf:'flex-end',paddingVertical:12,paddingHorizontal:18}}><Text style={{color:colors.ink}}>{t('Hide keyboard')}</Text></Pressable>
    <View style={{flexDirection:'row',justifyContent:'flex-end',gap:12,marginTop:16}}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{paddingVertical:12,paddingHorizontal:18}}><Text style={{color:colors.ink}}>{t('Close')}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={{paddingVertical:12,paddingHorizontal:18,borderRadius:20,backgroundColor:colors.accent,opacity:saving?0.6:1}}><Text style={{color:colors.onAccent,fontWeight:'600'}}>{t('Save note')}</Text></Pressable>
    </View>
  </ScrollView>;
}
