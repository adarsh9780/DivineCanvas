import React, { useMemo, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { Palette } from './readingAppearance';

type Props = {
  id:string; label:string; hint:string; moveUpLabel:string; moveDownLabel:string; colors:Palette; draggable:boolean; children:React.ReactNode;
  onMeasure:(id:string, y:number, height:number)=>void;
  onDrop:(id:string, dy:number)=>void;
  onMove:(id:string, direction:-1|1)=>void;
  onDragChange:(active:boolean)=>void;
};

export function MusicReorderRow({id,label,hint,moveUpLabel,moveDownLabel,colors,draggable,children,onMeasure,onDrop,onMove,onDragChange}:Props) {
  const [translate] = useState(() => new Animated.Value(0));
  const [dragging,setDragging] = useState(false);
  const responder=useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder:() => true,
    onMoveShouldSetPanResponder:() => true,
    onPanResponderTerminationRequest:() => false,
    onPanResponderGrant:() => {setDragging(true); onDragChange(true);},
    onPanResponderMove:(_event,gesture) => translate.setValue(gesture.dy),
    onPanResponderRelease:(_event,gesture) => {
      onDrop(id,gesture.dy); translate.setValue(0);
      setDragging(false); onDragChange(false);
    },
    onPanResponderTerminate:() => {translate.setValue(0); setDragging(false); onDragChange(false);},
  }),[id,translate,onDrop,onDragChange]);
  return <Animated.View onLayout={event => onMeasure(id,event.nativeEvent.layout.y,event.nativeEvent.layout.height)} style={{minHeight:88,flexDirection:'row',alignItems:'center',gap:8,paddingVertical:12,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:colors.line,backgroundColor:dragging?colors.white:'transparent',zIndex:dragging?10:0,elevation:dragging?4:0,transform:[{translateY:translate}]}}>
    {children}
    {draggable && <View {...responder.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityHint={hint} accessibilityActions={[{name:'increment',label:moveDownLabel},{name:'decrement',label:moveUpLabel}]} onAccessibilityAction={event => {if (event.nativeEvent.actionName==='increment') onMove(id,1); else if (event.nativeEvent.actionName==='decrement') onMove(id,-1);}} style={{width:44,height:48,alignItems:'center',justifyContent:'center'}}><SymbolView name={{ios:'line.3.horizontal',android:'drag_handle',web:'drag_handle'}} size={22} tintColor={colors.muted} accessible={false}/></View>}
  </Animated.View>;
}
