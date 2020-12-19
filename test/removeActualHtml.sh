for f in ./*_actual.html; do

echo $f
newname=$( echo $f | sed  's/_actual//' );
mv $f $newname;

done
