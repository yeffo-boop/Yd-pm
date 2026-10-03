include <vial_labeler.scad>  // render with: openscad -D 'size="none"' in_use_preview.scad
$fn = 120;
// 10 mL numbers (match the jig defaults)
r = v10_dia/2; lh = v10_label_h; lw = v10_label_w;
off = (v10_body - lh)/2;
ax = tray_t + under_gap + r + cradle_clear - cradle_clear; // vial axis height
wrap = 150;                       // degrees already wrapped
arc  = PI*r*wrap/180;
tail = lw - arc;

color([0.78,0.78,0.80]) jig10();

translate([0,0,ax]) {
  // glass vial
  color([0.82,0.92,1.0,0.45]) rotate([0,90,0]) {
    cylinder(r=r, h=v10_body);
    translate([0,0,v10_body]) cylinder(r1=r, r2=7, h=3);
    translate([0,0,v10_body+3]) cylinder(r=7, h=v10_len-v10_cap_len-v10_body-3);
  }
  // aluminium crimp + flip-off cap
  color([0.72,0.74,0.78]) translate([v10_len-v10_cap_len,0,0]) rotate([0,90,0]) cylinder(r=v10_cap_dia/2, h=v10_cap_len-2.5);
  color([0.10,0.16,0.45]) translate([v10_len-2.5,0,0]) rotate([0,90,0]) cylinder(r=v10_cap_dia/2, h=2.5);

  // label: wrapped part (from the top, rolling toward -y) ...
  color([0.97,0.94,0.86]) translate([off,0,0]) rotate([0,90,0])
    rotate([0,0,0]) rotate([0,0,180-wrap]) rotate_extrude(angle=wrap, $fn=180)
      translate([r,0]) square([0.15, lh]);
  // ... and the tail still feeding in between the fins, lifted slightly
  translate([off, 0, r]) rotate([-14,0,0]) translate([0,-tail,0]) {
    color([0.97,0.94,0.86]) cube([lh, tail, 0.15]);
    color([0.55,0.08,0.15]) translate([lh/2, tail*0.45, 0.15])
      linear_extrude(0.1) rotate(-90) text("SAMPLE", size=4.2, halign="center", valign="center");
    color([0.75,0.6,0.2]) translate([3, tail*0.72, 0.15]) cube([lh-6, 0.7, 0.1]);
  }
}
