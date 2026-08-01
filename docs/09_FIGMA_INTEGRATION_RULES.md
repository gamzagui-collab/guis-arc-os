# Figma Integration Rules

Figma 생성 HTML, CSS, React 코드를 통째로 직접 병합하지 않는다. 먼저 화면의 layout, token, component, interaction을 분해하고 기존 Core authentication, permission, accessibility, responsive, performance 계약을 보존한다.

색상·간격·글꼴·radius는 design token으로 수동 이식한다. Button, Card, Dialog, Badge, Filter, Table, Navigation은 공통 UI package를 수정하고 module-local 복제를 금지한다. 교체 후 contract test, keyboard 접근, 360/390/412px overflow와 bundle budget을 재검증한다.
