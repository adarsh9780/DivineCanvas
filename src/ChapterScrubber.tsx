import React from 'react';
import { PanResponder, View } from 'react-native';
import { chapterScrubPosition } from './chapterScrubPosition';

const CONTROL_WIDTH=168;

type Props = {current:number; count:number; bottom:number; light:boolean; active:boolean; label:string; onActiveChange:(active:boolean)=>void; onPreview:(position:number)=>void; onSelect:(position:number)=>void};

/** A compact chapter index with a larger, accessible touch target. */
export class ChapterScrubber extends React.Component<Props> {
  private startIndex=0;
  private lastPosition=-1;
  componentWillUnmount() {if (this.lastPosition>=0) this.props.onActiveChange(false);}
  private positionAt(dx:number) {return chapterScrubPosition(this.startIndex,dx,this.props.count,CONTROL_WIDTH);}
  private preview(x:number) {
    const position=this.positionAt(x);
    if (position!==this.lastPosition) {this.lastPosition=position; this.props.onPreview(position);}
  }
  private pan=PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onPanResponderTerminationRequest:()=>false,
    onPanResponderGrant:() => {this.startIndex=this.props.current; this.lastPosition=this.startIndex; this.props.onActiveChange(true);},
    onPanResponderMove:(_event,gesture) => this.preview(gesture.dx),
    onPanResponderRelease:(_event,gesture) => {const position=this.positionAt(gesture.dx); this.lastPosition=-1; this.props.onSelect(position); this.props.onActiveChange(false);},
    onPanResponderTerminate:() => {const position=this.lastPosition; this.lastPosition=-1; if(position>=0) this.props.onSelect(position); this.props.onActiveChange(false);},
  });
  render() {
    const {current,count,bottom,light,active:engaged,label,onSelect}=this.props;
    const ticks=15;
    const active=7;
    return <View {...this.pan.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{min:1,max:count,now:current+1,text:`${current+1} / ${count}`}} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={event => {if(event.nativeEvent.actionName==='increment') onSelect(Math.min(count-1,current+1)); else if(event.nativeEvent.actionName==='decrement') onSelect(Math.max(0,current-1));}} style={{position:'absolute',left:'50%',marginLeft:-84,bottom,width:CONTROL_WIDTH,height:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
      {Array.from({length:ticks},(_,i) => <View key={i} pointerEvents="none" style={{height:i===active?14:12,width:2,borderRadius:1,opacity:i===active ? 1 : engaged ? 0.85 : 0.55,backgroundColor:light ? '#fff' : '#65686b'}}/>)}
    </View>;
  }
}
