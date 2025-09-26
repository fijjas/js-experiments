(module
  (func $fibonacci (param $max i32) (result i32)
    (local $a i32)
    (local $b i32)
    (local $c i32)
    (local $i i32)
    (local.set $a (i32.const 0))
    (local.set $b (i32.const 1))
    (local.set $c (i32.const 0))
    (local.set $i (i32.const 0))

    (block $exit
      (loop $loop
        (br_if $exit (i32.ge_u (local.get $i) (local.get $max)))
        ;; avoid de-optimizing because of reaching max small integer - XOR 0xFF
        (local.set $c
          (i32.xor
            (i32.add (local.get $a) (local.get $b))
            (i32.const 0xFF)
          )
        )
        (local.set $a (local.get $b))
        (local.set $b (local.get $c))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
    (local.get $c)
  )
  (export "fibonacci" (func $fibonacci))
)
