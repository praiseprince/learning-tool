"use client";
import {ReactFlow,Controls,Background,BackgroundVariant,type ReactFlowProps} from "@xyflow/react";
export default function GraphCanvas(props:ReactFlowProps){
 return <ReactFlow {...props}><Controls showInteractive={false}/><Background variant={BackgroundVariant.Dots} gap={32}/></ReactFlow>;
}
