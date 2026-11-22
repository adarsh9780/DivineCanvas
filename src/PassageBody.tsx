import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, type TextLayoutEvent, type TextStyle, type StyleProp } from 'react-native';
import { useAppLanguage } from './AppLanguage';
import { centeredPassageOffset, measuredPassageSlices, type PassageSlice } from './passagePages';

type Props = {
  text:string;
  fontSize:number;
  pageContentHeight:number;
  textStyle:StyleProp<TextStyle>;
  continuationColor:string;
  renderText:(text:string, start:number, size:number)=>React.ReactNode;
  renderTools:()=>React.ReactNode;
  active:boolean;
  registerNavigation:(navigator:{advance:()=>boolean; hasMore:()=>boolean}|null)=>void;
  onPartChange:()=>void;
};
/** A native text measurement keeps short entries whole and breaks long ones at rendered line boundaries. */
export function PassageBody({text, fontSize, pageContentHeight, textStyle, continuationColor, renderText, renderTools, active, registerNavigation, onPartChange}:Props) {
  const {appLanguage,t}=useAppLanguage();
  const [height,setHeight]=useState(0);
  const [size,setSize]=useState(fontSize);
  const [textHeight,setTextHeight]=useState(0);
  const [slices,setSlices]=useState<PassageSlice[] | null>(null);
  const [fallbackOverflow,setFallbackOverflow]=useState(false);
  const scroll=useRef<React.ComponentRef<typeof ScrollView>>(null);
  const part=useRef(0);
  useEffect(() => {
    if (!active || !slices || slices.length < 2) return;
    const navigator = {hasMore:() => part.current < slices.length-1, advance:() => {
      if (part.current >= slices.length-1 || !scroll.current) return false;
      part.current += 1;
      scroll.current.scrollTo({y:part.current*height,animated:true});
      onPartChange();
      return true;
    }};
    registerNavigation(navigator);
    return () => registerNavigation(null);
  }, [active, slices, height, registerNavigation, onPartChange]);
  const measure=useCallback((event:TextLayoutEvent) => {
    const lines=event.nativeEvent.lines;
    if (!height || !lines.length || slices) return;
    // Reserve room for a continuation label and the selector controls.
    const available=Math.max(32,height-64);
    const total=lines[lines.length-1].y+lines[lines.length-1].height;
    const minimum=Math.min(fontSize,Math.max(18,Math.floor(fontSize*0.8)));
    if (total > available && size > minimum) {
      setSize(Math.max(minimum, Math.min(size-1,Math.floor(size*available/total))));
      return;
    }
    setTextHeight(total);
    const measured=measuredPassageSlices(text,lines,available);
    if (!measured && total > available) setFallbackOverflow(true);
    setSlices(measured ?? [{start:0,end:text.length}]);
  },[height,slices,fontSize,size,text]);
  const centerOffset=slices?.length===1 && !fallbackOverflow ? centeredPassageOffset(pageContentHeight,height,textHeight) : 0;
  return <View style={{flex:1}} onLayout={event=>setHeight(event.nativeEvent.layout.height)}>
    {!!height && !!text && !slices && <Text accessible={false} pointerEvents="none" onTextLayout={measure} style={[textStyle,{position:'absolute',opacity:0,width:'100%',fontSize:size,lineHeight:Math.round(size*1.5)}]}>{text}</Text>}
    {!!slices && <ScrollView ref={scroll} style={{flex:1,transform:[{translateY:centerOffset}]}} nestedScrollEnabled pagingEnabled={slices.length>1} showsVerticalScrollIndicator={slices.length===1} onMomentumScrollEnd={event => {
      const next=Math.min(slices.length-1,Math.max(0,Math.round(event.nativeEvent.contentOffset.y/height)));
      if (next !== part.current) {part.current=next; onPartChange();}
    }}>
      {slices.map((slice,i)=><View key={slice.start} style={{minHeight:height,justifyContent:'center',paddingVertical:16}}>
        {fallbackOverflow && <Text style={{color:continuationColor,fontSize:13,marginBottom:16}}>{t("Continued below")}</Text>}
        {renderText(text.slice(slice.start,slice.end),slice.start,size)}
        {renderTools()}
        {slices.length>1 && <Text accessibilityLiveRegion="polite" style={{color:continuationColor,fontSize:13,marginTop:16}}>{i < slices.length-1 ? `${appLanguage==='hi'?'भाग':'Part'} ${i+1} / ${slices.length} · ${appLanguage==='hi'?'आगे जारी है':'continued below'}` : `${appLanguage==='hi'?'भाग':'Part'} ${i+1} / ${slices.length} · ${appLanguage==='hi'?'पिछले भाग से जारी':'continued from above'}`}</Text>}
      </View>)}
    </ScrollView>}
  </View>;
}
