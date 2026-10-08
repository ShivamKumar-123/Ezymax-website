// Web builds have no WebView chart: chart_surface.dart uses the native painter there.
import 'package:flutter/widgets.dart';

import 'chart_native.dart';
import 'chart_surface.dart';

Widget webViewChartSurface(ChartSurfaceController c) => NativeChartSurface(controller: c);
