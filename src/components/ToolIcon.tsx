import { Icon } from '@astryxdesign/core/Icon';
// Astryx Neutral uses Lucide. Extra photo symbols use the same family through Icon.
import {
  Aperture, Blend, Circle, CircleOff, CloudOff, Contrast, Cpu, Download,
  Droplets, Eraser, Expand, Eye, Focus, Frame, History, Image, ImagePlus,
  Layers, Maximize, Moon, Paintbrush, Palette, RotateCcw, Save, Scan, ScanFace,
  ShieldCheck, SlidersHorizontal, Sparkles, Square, SquareRoundCorner,
  Sun, SunDim, Sunrise, Thermometer, Trash2, Undo2, Redo2, Upload, UserRound, WandSparkles,
} from 'lucide-react';

const icons = {
  aperture: Aperture, blend: Blend, circle: Circle, off: CircleOff,
  cloudOff: CloudOff, contrast: Contrast, cpu: Cpu, download: Download,
  droplets: Droplets, eraser: Eraser, expand: Expand, eye: Eye, focus: Focus,
  frame: Frame, history: History, image: Image, imagePlus: ImagePlus,
  layers: Layers, maximize: Maximize, moon: Moon, paintbrush: Paintbrush,
  palette: Palette, reset: RotateCcw, save: Save, scan: Scan, face: ScanFace,
  shield: ShieldCheck, sliders: SlidersHorizontal, sparkles: Sparkles,
  square: Square, rounded: SquareRoundCorner, sun: Sun, sunDim: SunDim,
  sunrise: Sunrise, thermometer: Thermometer, undo: Undo2, redo: Redo2,
  trash: Trash2, upload: Upload, person: UserRound, wand: WandSparkles,
};

export type ToolIconName = keyof typeof icons;
export default function ToolIcon({ name, size }: { name: ToolIconName; size?: 'xsm' | 'sm' | 'md' | 'lg' }) {
  return <Icon icon={icons[name]} size={size} />;
}
