import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppLanguage } from '../../AppLanguage';
import { useReaderSections } from '../../ReaderSections';
import { palettes } from '../../readingAppearance';

export default function ExploreTab() {
  const {appLanguage}=useAppLanguage();
  const {colorTheme}=useReaderSections();
  const colors=palettes[colorTheme];
  const router=useRouter();
  return <SafeAreaView style={[styles.root,{backgroundColor:colors.paper}]} edges={['top','left','right']}>
    <View style={[styles.header,{borderColor:colors.line}]}><Text accessibilityRole="header" style={[styles.title,{color:colors.ink}]}>{appLanguage==='hi'?'अन्वेषण':'Explore'}</Text></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.intro,{color:colors.muted}]}>{appLanguage==='hi'?'चिंतन और खोज के लिए स्थान।':'A space for reflection and discovery.'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={appLanguage==='hi'?'प्रश्नावली खोलें':'Open Prashnavali'} onPress={() => router.push({pathname:'/prashnavali',params:{theme:colorTheme}})} style={[styles.row,{borderColor:colors.line}]}>
        <View style={styles.rowText}><Text style={[styles.rowTitle,{color:colors.ink}]}>{appLanguage==='hi'?'श्री राम प्रश्नावली':'Prashnavali'}</Text><Text style={[styles.description,{color:colors.muted}]}>{appLanguage==='hi'?'मन में प्रश्न रखें और एक अक्षर चुनें।':'Hold a question in your heart and choose a square.'}</Text></View><Text style={[styles.chevron,{color:colors.muted}]}>›</Text>
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({root:{flex:1},header:{minHeight:64,flexDirection:'row',alignItems:'center',paddingHorizontal:16,borderBottomWidth:1},title:{fontSize:20,fontWeight:'600'},content:{paddingHorizontal:24,paddingTop:24,paddingBottom:32},intro:{fontSize:15,lineHeight:22,marginBottom:16},row:{minHeight:88,flexDirection:'row',alignItems:'center',gap:16,paddingVertical:18,borderBottomWidth:1},rowText:{flex:1,gap:6},rowTitle:{fontSize:17,fontWeight:'600'},description:{fontSize:14,lineHeight:20},chevron:{fontSize:28}});
