// iPhone 미러링 창에 마우스 입력을 보낸다(scripts/mirror.sh가 컴파일해 부른다). 좌표는 화면 point.
//   input tap X Y [누름ms]          누름ms를 주면 길게 누르기
//   input drag X1 Y1 X2 Y2 [단계] [누름ms]  누름ms를 주면 길게 누른 뒤 끌기
import CoreGraphics
import Foundation

func post(_ type: CGEventType, _ p: CGPoint) {
  CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: p, mouseButton: .left)?
    .post(tap: .cghidEventTap)
}

func sleepMs(_ ms: Double) { usleep(useconds_t(ms * 1000)) }

let args = CommandLine.arguments.dropFirst()
let command = args.first ?? ""
let n = args.dropFirst().compactMap { Double($0) }

switch (command, n.count) {
case ("tap", 2...3):
  let p = CGPoint(x: n[0], y: n[1])
  post(.mouseMoved, p)
  sleepMs(80)
  post(.leftMouseDown, p)
  sleepMs(n.count == 3 ? n[2] : 60)
  post(.leftMouseUp, p)
case ("drag", 4...6):
  let from = CGPoint(x: n[0], y: n[1])
  let to = CGPoint(x: n[2], y: n[3])
  let steps = n.count > 4 ? max(1, Int(n[4])) : 20
  post(.mouseMoved, from)
  sleepMs(80)
  post(.leftMouseDown, from)
  if n.count > 5 { sleepMs(n[5]) }
  for i in 1...steps {
    let f = Double(i) / Double(steps)
    post(.leftMouseDragged, CGPoint(x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f))
    sleepMs(16)
  }
  post(.leftMouseUp, to)
default:
  FileHandle.standardError.write("usage: input tap X Y [ms] | input drag X1 Y1 X2 Y2 [steps] [ms]\n".data(using: .utf8)!)
  exit(2)
}
