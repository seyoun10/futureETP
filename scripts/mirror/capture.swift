// iPhone 미러링 창 캡처 보조(scripts/mirror.sh가 컴파일해 부른다).
//   capture id PID                  그 프로세스의 화면에 보이는 첫 일반 창 번호(screencapture -l 용)
//   capture crop 원본 결과 폭          불투명한 영역(휴대폰)만 잘라 폭 px로 줄인 PNG
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
  FileHandle.standardError.write("capture: \(message)\n".data(using: .utf8)!)
  exit(1)
}

func windowId(pid: Int) {
  let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? []
  let window = list.first {
    ($0[kCGWindowOwnerPID as String] as? Int) == pid && ($0[kCGWindowLayer as String] as? Int) == 0
  }
  guard let id = window?[kCGWindowNumber as String] as? Int else { fail("창을 찾지 못함(pid \(pid))") }
  print(id)
}

func crop(_ src: String, _ dst: String, _ outWidth: Int) {
  guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: src) as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else { fail("이미지를 읽지 못함: \(src)") }
  let w = image.width, h = image.height
  var pixels = [UInt8](repeating: 0, count: w * h * 4)
  let rgb = CGColorSpaceCreateDeviceRGB()
  let alpha = CGImageAlphaInfo.premultipliedLast.rawValue
  CGContext(data: &pixels, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: rgb, bitmapInfo: alpha)!
    .draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
  // 둥근 모서리 가장자리의 반투명 픽셀은 빼고 거의 불투명한 범위만 본다
  var x0 = w, x1 = -1, y0 = h, y1 = -1
  for y in 0..<h {
    for x in 0..<w where pixels[(y * w + x) * 4 + 3] > 200 {
      x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y)
    }
  }
  guard x1 >= x0, let phone = image.cropping(to: CGRect(x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1))
  else { fail("불투명한 영역이 없음") }
  let outHeight = Int((Double(phone.height) * Double(outWidth) / Double(phone.width)).rounded())
  let out = CGContext(data: nil, width: outWidth, height: outHeight, bitsPerComponent: 8, bytesPerRow: 0, space: rgb, bitmapInfo: alpha)!
  out.interpolationQuality = .high
  out.draw(phone, in: CGRect(x: 0, y: 0, width: outWidth, height: outHeight))
  guard let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: dst) as CFURL, UTType.png.identifier as CFString, 1, nil)
  else { fail("쓸 수 없음: \(dst)") }
  CGImageDestinationAddImage(dest, out.makeImage()!, nil)
  if !CGImageDestinationFinalize(dest) { fail("쓰지 못함: \(dst)") }
}

let args = Array(CommandLine.arguments.dropFirst())
switch (args.first ?? "", args.count) {
case ("id", 2):
  guard let pid = Int(args[1]) else { fail("PID는 숫자") }
  windowId(pid: pid)
case ("crop", 4):
  guard let width = Int(args[3]), width > 0 else { fail("폭은 양의 정수") }
  crop(args[1], args[2], width)
default:
  fail("usage: capture id PID | capture crop SRC DST WIDTH")
}
