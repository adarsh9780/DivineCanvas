import React from 'react';
import { PanResponder, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { chapterScrubPosition } from './chapterScrubPosition';

type Props = {
  current:number;
  count:number;
  bottom:number;
  light:boolean;
  active:boolean;
  label:string;
  reference:string;
  referenceLabel:string;
  referenceStyle:StyleProp<TextStyle>;
  hint:string;
  onActiveChange:(active:boolean)=>void;
  onPreview:(position:number)=>void;
  onSelect:(position:number)=>void;
};

/** Hold the chapter reference to reveal a draggable chapter scale. */
export class ChapterScrubber extends React.Component<Props> {
  private startIndex=0;
  private lastPosition=-1;
  private controlWidth=1;
  private holdTimer:ReturnType<typeof setTimeout> | null=null;
  private engaged=false;

  componentWillUnmount() {
    this.cancelHold();
    if (this.engaged) this.props.onActiveChange(false);
  }
  private cancelHold() {
    if (this.holdTimer) clearTimeout(this.holdTimer);
    this.holdTimer=null;
  }
  private positionAt(dx:number) {
    return chapterScrubPosition(this.startIndex,dx,this.props.count,this.controlWidth);
  }
  private preview(dx:number) {
    const position=this.positionAt(dx);
    if (position!==this.lastPosition) {
      this.lastPosition=position;
      this.props.onPreview(position);
    }
  }
  private pan=PanResponder.create({
    onStartShouldSetPanResponder:()=>this.props.count>1,
    onMoveShouldSetPanResponder:()=>false,
    onPanResponderTerminationRequest:()=>!this.engaged,
    onPanResponderGrant:() => {
      this.startIndex=this.props.current;
      this.lastPosition=this.startIndex;
      this.holdTimer=setTimeout(() => {
        this.holdTimer=null;
        this.engaged=true;
        this.props.onActiveChange(true);
      }, 400);
    },
    onPanResponderMove:(_event,gesture) => {
      if (this.engaged) this.preview(gesture.dx);
      else if (Math.hypot(gesture.dx,gesture.dy)>10) this.cancelHold();
    },
    onPanResponderRelease:(_event,gesture) => {
      this.cancelHold();
      if (this.engaged) {
        this.props.onSelect(this.positionAt(gesture.dx));
        this.engaged=false;
        this.props.onActiveChange(false);
      }
      this.lastPosition=-1;
    },
    onPanResponderTerminate:() => {
      this.cancelHold();
      if (this.engaged) {
        if (this.lastPosition>=0) this.props.onSelect(this.lastPosition);
        this.engaged=false;
        this.props.onActiveChange(false);
      }
      this.lastPosition=-1;
    },
  });
  render() {
    const {current,count,bottom,light,active,label,reference,referenceLabel,referenceStyle,hint,onSelect}=this.props;
    return <View pointerEvents="box-none" onLayout={event => {this.controlWidth=Math.max(1,(event.nativeEvent.layout.width-32)/2);}} style={{position:'absolute',left:0,right:0,bottom,height:44,alignItems:'center',justifyContent:'center'}}>
      <View {...this.pan.panHandlers} accessible accessibilityRole={count>1?'adjustable':'text'} accessibilityLabel={`${referenceLabel}, ${label}`} accessibilityHint={count>1?hint:undefined} accessibilityValue={count>1?{min:1,max:count,now:current+1,text:`${current+1} / ${count}`}:undefined} accessibilityActions={count>1?[{name:'increment'},{name:'decrement'}]:undefined} onAccessibilityAction={event => {if(event.nativeEvent.actionName==='increment') onSelect(Math.min(count-1,current+1)); else if(event.nativeEvent.actionName==='decrement') onSelect(Math.max(0,current-1));}} style={{height:44,width:active?'100%':200,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:active?'space-between':'center'}}>
        {active ? Array.from({length:31},(_,i) => <View key={i} pointerEvents="none" style={{height:i===Math.round(current/Math.max(1,count-1)*30)?16:10,width:2,borderRadius:1,opacity:i===Math.round(current/Math.max(1,count-1)*30)?1:0.6,backgroundColor:light?'#fff':'#65686b'}}/>) : <Text style={referenceStyle}>{reference}</Text>}
      </View>
    </View>;
  }
}
