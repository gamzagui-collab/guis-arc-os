# Module Data Ownership

Core service contract 없이 module이 `users`, `memberships`, `roles`, `permissions`, `sessions`를 변경할 수 없다. OS/Issue module은 Core user/site ID를 foreign reference로 사용할 뿐 identity를 새로 만들지 않는다. 파일 metadata는 Core adapter가 관리하지만 업무 record와 retention 판단은 owning module이 제공한다.
