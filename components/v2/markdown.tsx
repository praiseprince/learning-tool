import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeSanitize,{defaultSchema} from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type {WikiLink} from "@/lib/v2/notebook";

const schema={...defaultSchema,attributes:{...defaultSchema.attributes,code:[...(defaultSchema.attributes?.code||[]),["className",/^language-./,"math-inline","math-display"]]}};
export function Markdown({text,links=[]}:{text:string;links?:WikiLink[]}) {
 const known=new Map(links.map(l=>[l.label,l.nodeId]));
 // Leave wiki text inside code and equation spans literal.
 const linked=text.split(/(```[\s\S]*?```|`[^`\n]*`|\$\$[\s\S]*?\$\$|\$[^$\n]*\$)/g).map((part,index)=>index%2?part:part.replace(/\[\[([^\]\n]+)\]\]/g,(original,label:string)=>{
  const node=known.get(label.trim());return node?`[${label.replace(/[\\[\]]/g,"\\$&")}](/atlas/n/${encodeURIComponent(node)})`:original;
 })).join("");
 return <div className="v2-prose"><ReactMarkdown skipHtml remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[[rehypeSanitize,schema],[rehypeKatex,{trust:false,throwOnError:false,output:"htmlAndMathml"}]]} components={{img:({alt})=><span>{alt||"Image"}</span>}}>{linked}</ReactMarkdown></div>;
}
